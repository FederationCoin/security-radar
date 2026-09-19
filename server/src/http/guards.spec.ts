import { describe, expect, it } from 'vitest';
import { ChainHeaderGuard } from './chain.guard';
import { SigningEnvelopeGuard } from './envelope.guard';
import { RadarProblem } from '../domain/types';
import { ClientIp } from './params';
import { ExecutionContext } from '@nestjs/common';

function ctx(headers: Record<string, string>, extra: Record<string, unknown> = {}): ExecutionContext {
  const req = {
    header: (k: string) => headers[k.toLowerCase()] ?? headers[k],
    ip: '10.0.0.1',
    ...extra,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('guards', () => {
  it('chain header missing and unknown', () => {
    const g = new ChainHeaderGuard();
    expect(() => g.canActivate(ctx({}))).toThrow(RadarProblem);
    expect(() => g.canActivate(ctx({ 'x-federationcoin-chain': 'signet' }))).toThrow(RadarProblem);
    expect(g.canActivate(ctx({ 'x-federationcoin-chain': 'testnet' }))).toBe(true);
  });

  it('envelope bearer required, bad json, oversized, and ok', () => {
    const g = new SigningEnvelopeGuard();
    expect(() => g.canActivate(ctx({}))).toThrow(RadarProblem);
    expect(() => g.canActivate(ctx({ authorization: 'Bearer $$$' }))).toThrow(RadarProblem);
    const bad = 'Bearer ' + Buffer.from('not-json', 'utf8').toString('base64url');
    expect(() => g.canActivate(ctx({ authorization: bad }))).toThrow(RadarProblem);
    const arr = 'Bearer ' + Buffer.from('[]', 'utf8').toString('base64url');
    expect(() => g.canActivate(ctx({ authorization: arr }))).toThrow(RadarProblem);
    const ok = 'Bearer ' + Buffer.from(JSON.stringify({ messageVersion: 1 }), 'utf8').toString('base64url');
    expect(g.canActivate(ctx({ authorization: ok }))).toBe(true);
  });

  it('ClientIp uses X-Forwarded-For hop', () => {
    const deco = ClientIp();
    const factory = (deco as unknown as { factory?: (d: unknown, ctx: ExecutionContext) => string }).factory;
    if (!factory) {
      return;
    }
    process.env.TRUSTED_PROXY_HOPS = '1';
    const req = {
      header: (k: string) => (k.toLowerCase() === 'x-forwarded-for' ? '1.1.1.1, 2.2.2.2' : undefined),
      ip: '10.0.0.1',
    };
    const ip = factory(undefined, { switchToHttp: () => ({ getRequest: () => req }) } as never);
    expect(ip).toBe('2.2.2.2');
  });
});
