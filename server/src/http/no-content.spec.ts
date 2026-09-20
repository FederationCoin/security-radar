import { describe, expect, it, vi } from 'vitest';
import { sendCollection, sendRepresentation } from './no-content';
import type { Response } from 'express';

function res() {
  return { status: vi.fn() } as unknown as Response & { status: ReturnType<typeof vi.fn> };
}

describe('no-content', () => {
  it('sends 204 when a representation is absent', () => {
    const r = res();
    expect(sendRepresentation(r, undefined)).toBeUndefined();
    expect(r.status).toHaveBeenCalledWith(204);
    expect(sendRepresentation(r, null)).toBeUndefined();
    const body = { id: 'c' };
    expect(sendRepresentation(r, body)).toBe(body);
  });

  it('sends 204 when a collection has no members', () => {
    const r = res();
    expect(sendCollection(r, { items: [] })).toBeUndefined();
    expect(r.status).toHaveBeenCalledWith(204);
    const page = { items: [{ id: '1' }] };
    expect(sendCollection(r, page)).toBe(page);
  });
});
