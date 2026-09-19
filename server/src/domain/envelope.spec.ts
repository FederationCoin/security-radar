import { describe, expect, it } from 'vitest';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import * as secp from '@noble/secp256k1';
import { signedPayloadHash } from './jcs';
import { assertEnvelope, decodeCompactSig, signedMessageHash, sparrowMessageHash, verifyEnvelopeSignature } from './envelope';
import { signEnvelope, testKey } from '../test-support';
import { BitcoinSignedMessageMagic } from './constants';
import { RadarProblem } from './types';

secp.etc.hmacSha256Sync = (k, ...msgs) => {
  const h = hmac.create(sha256, k);
  for (const m of msgs) {
    h.update(m);
  }
  return h.digest();
};

describe('envelope', () => {
  it('verifies a Sparrow compact signature over payloadHash', () => {
    const { priv, wallet } = testKey();
    const command = { taskId: '01HZX' };
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command,
      signingBlockHash: 'ab'.repeat(32),
      signingBlockHeight: 1,
    });
    expect(env.payloadHash).toBe(signedPayloadHash(command, 1, 'ab'.repeat(32)));
    expect(() => assertEnvelope(env, 'testnet', 'acceptTask', command)).not.toThrow();
  });

  it('binds signing height and hash into the payload hash', () => {
    const command = { taskId: '01HZX' };
    const hash = 'ab'.repeat(32);
    expect(signedPayloadHash(command, 1, hash)).not.toBe(signedPayloadHash(command, 2, hash));
    expect(signedPayloadHash(command, 1, hash)).not.toBe(signedPayloadHash(command, 1, 'cd'.repeat(32)));
  });

  it('rejects tip mutation as payloadHashMismatch', () => {
    const { priv, wallet } = testKey();
    const command = { taskId: '01HZX' };
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command,
      signingBlockHash: 'ab'.repeat(32),
      signingBlockHeight: 1,
    });
    env.signingBlockHeight = 2;
    try {
      assertEnvelope(env, 'testnet', 'acceptTask', command);
      expect.fail('expected payloadHashMismatch');
    } catch (e) {
      expect(e).toBeInstanceOf(RadarProblem);
      expect((e as RadarProblem).code).toBe('payloadHashMismatch');
    }
  });

  it('rejects commandKind mismatch, bad version, chain mismatch, and short sig', () => {
    const { priv, wallet } = testKey();
    const command = { taskId: '01HZX' };
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command,
      signingBlockHash: 'ab'.repeat(32),
      signingBlockHeight: 1,
    });
    expect(() => assertEnvelope(env, 'testnet', 'completeTask', command)).toThrow(RadarProblem);
    expect(() => assertEnvelope(env, 'main', 'acceptTask', command)).toThrow(RadarProblem);
    env.messageVersion = 2;
    expect(() => assertEnvelope(env, 'testnet', 'acceptTask', command)).toThrow(RadarProblem);
    expect(() => decodeCompactSig('aaa')).toThrow(RadarProblem);
    env.messageVersion = 1;
    env.signature = Buffer.alloc(65, 1).toString('base64');
    expect(() => verifyEnvelopeSignature(env)).toThrow(RadarProblem);
  });

  it('decodes compact sig with compressed header and hashes long messages', () => {
    const buf = Buffer.alloc(65, 2);
    buf[0] = 31;
    const { recId } = decodeCompactSig(buf.toString('base64'));
    expect(recId).toBe(0);
    const long = 'x'.repeat(300);
    expect(sparrowMessageHash(long).length).toBe(32);
  });

  it('accepts Bitcoin signed-message magic then FederationCoin', () => {
    const { priv, wallet } = testKey();
    const command = { taskId: '01HZX' };
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command,
      signingBlockHash: 'ab'.repeat(32),
      signingBlockHeight: 1,
    });
    const hash = signedMessageHash(env.payloadHash, BitcoinSignedMessageMagic);
    const sig = secp.sign(hash, priv);
    const rec = sig.recovery ?? 0;
    const header = 27 + 4 + rec;
    env.signature = Buffer.concat([Buffer.from([header]), Buffer.from(sig.toCompactRawBytes())]).toString('base64url');
    expect(() => verifyEnvelopeSignature(env)).not.toThrow();
  });
});