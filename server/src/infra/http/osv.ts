import type { OsvPort } from '../../ports/chain-view';

export class HttpOsvPort implements OsvPort {
  async query(packageIdentity: string, version: string): Promise<Array<{ id: string; summary: string }>> {
    try {
      const res = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ package: { name: packageIdentity }, version }),
      });
      if (!res.ok) {
        return [];
      }
      const body = (await res.json()) as { vulns?: Array<{ id?: string; summary?: string }> };
      return (body.vulns ?? [])
        .filter((v) => v.id)
        .map((v) => ({ id: v.id as string, summary: v.summary ?? '' }));
    } catch {
      return [];
    }
  }
}
