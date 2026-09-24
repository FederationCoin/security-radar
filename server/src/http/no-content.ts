import type { Response } from 'express';

/** 204 empty body when the URI is right and there is no representation. */
export function sendRepresentation<T>(res: Response, body: T | undefined | null): T | undefined {
  if (body == null) {
    res.status(204);
    return undefined;
  }
  return body;
}

export function sendCollection<T extends { items: unknown[] }>(res: Response, page: T): T | undefined {
  if (page.items.length === 0) {
    res.status(204);
    return undefined;
  }
  return page;
}
