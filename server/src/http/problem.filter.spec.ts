import { describe, expect, it } from 'vitest';
import { ProblemFilter } from './problem.filter';
import { RadarProblem } from '../domain/types';
import { HttpException } from '@nestjs/common';

function res() {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: unknown;
  return {
    headers,
    statusCode: () => status,
    body: () => body,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: (n: number) => {
      status = n;
      return {
        type: () => ({
          json: (b: unknown) => {
            body = b;
          },
        }),
      };
    },
  };
}

describe('ProblemFilter', () => {
  const filter = new ProblemFilter();

  it('maps RadarProblem and Retry-After', () => {
    const r = res();
    filter.catch(new RadarProblem(429, 'rateLimited', 'Too many requests', '12'), {
      switchToHttp: () => ({ getResponse: () => r }),
    } as never);
    expect(r.statusCode()).toBe(429);
    expect(r.headers['Retry-After']).toBe('12');
  });

  it('maps HttpException 404 and string body', () => {
    const r = res();
    filter.catch(new HttpException('nope', 404), {
      switchToHttp: () => ({ getResponse: () => r }),
    } as never);
    expect(r.statusCode()).toBe(404);
    expect((r.body() as { code: string }).code).toBe('notFound');
  });

  it('maps HttpException object body and unknown errors', () => {
    const r = res();
    filter.catch(new HttpException({ message: 'bad' }, 400), {
      switchToHttp: () => ({ getResponse: () => r }),
    } as never);
    expect(r.statusCode()).toBe(400);
    const r2 = res();
    filter.catch(new Error('boom'), {
      switchToHttp: () => ({ getResponse: () => r2 }),
    } as never);
    expect(r2.statusCode()).toBe(500);
  });
});
