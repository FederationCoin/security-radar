import { bech32 } from 'bech32';
import { describe, expect, it } from 'vitest';
import { assertP2wpkh, encodeP2wpkh } from './wallet';
import { RadarProblem } from './types';

describe('wallet', () => {
  it('encodes and accepts P2WPKH', () => {
    const prog = new Uint8Array(20).fill(7);
    const addr = encodeP2wpkh('testnet', prog);
    expect(addr.startsWith('tgfcn1')).toBe(true);
    expect(assertP2wpkh(addr, 'testnet')).toEqual(prog);
  });

  it('rejects taproot, wrong HRP, empty, and garbage', () => {
    expect(() => assertP2wpkh('not-an-address', 'testnet')).toThrow(RadarProblem);
    expect(() => assertP2wpkh('', 'testnet')).toThrow(RadarProblem);
    const main = encodeP2wpkh('main', new Uint8Array(20).fill(1));
    expect(() => assertP2wpkh(main, 'testnet')).toThrow(RadarProblem);
    const tap = bech32.encode('tgfcn', [1, ...bech32.toWords(Buffer.alloc(32, 2))]);
    expect(() => assertP2wpkh(tap, 'testnet')).toThrow(RadarProblem);
    const short = bech32.encode('tgfcn', [0, ...bech32.toWords(Buffer.alloc(32, 3))]);
    expect(() => assertP2wpkh(short, 'testnet')).toThrow(RadarProblem);
  });
});
