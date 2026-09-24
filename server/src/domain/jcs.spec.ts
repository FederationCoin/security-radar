import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jcs, payloadHashHex, sha256Hex } from './jcs';
import { EnvFileSecretStore, StaticSecretStore, defaultApiSettings, defaultCollectorSettings } from '../infra/secrets/env-file';
import { RadarProblem } from './types';
import { recoveredAddress } from './envelope';
import { signEnvelope, testKey } from '../test-support';

describe('jcs and settings', () => {
  it('canonicalizes and hashes', () => {
    expect(jcs({ b: 1, a: 2 })).toBe(jcs({ a: 2, b: 1 }));
    expect(payloadHashHex({ x: 1 })).toHaveLength(64);
    expect(sha256Hex('abc')).toHaveLength(64);
    expect(() => jcs(undefined)).toThrow();
  });

  it('loads static and file settings and recovers address', async () => {
    const api = new StaticSecretStore(defaultApiSettings());
    expect((await api.load()).corsOrigins[0]).toContain('radar.federationcoin.org');
    const col = new StaticSecretStore(defaultCollectorSettings());
    expect((await col.load()).xHandles).toEqual([]);
    const dir = await mkdtemp(join(tmpdir(), 'radar-'));
    const path = await Promise.resolve(join(dir, 's.json'));
    await writeFile(path, JSON.stringify(defaultApiSettings()));
    expect((await new EnvFileSecretStore(path).load()).trustedProxyHops).toBe(1);
    const p = new RadarProblem(400, 'badEnvelope', 'x');
    expect(p.toBody().code).toBe('badEnvelope');
    const { priv, wallet } = testKey();
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      signingBlockHash: 'ab'.repeat(32),
      signingBlockHeight: 1,
    });
    expect(recoveredAddress(env)).toBe(wallet);
  });
});
