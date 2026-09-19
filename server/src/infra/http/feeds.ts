import { bech32 } from 'bech32';
import type { NostrPort, RssPort, XPort } from '../../ports/chain-view';

export class HttpXPort implements XPort {
  constructor(private readonly bearer: string) {}

  async pollHandle(handle: string): Promise<Array<{ id: string; text: string; createdAt: string }>> {
    const res = await fetch(
      `https://api.x.com/2/tweets/search/recent?query=from:${encodeURIComponent(handle)}&max_results=10`,
      { headers: { authorization: `Bearer ${this.bearer}` } },
    );
    if (!res.ok) {
      throw new Error(`X ${res.status}`);
    }
    const body = (await res.json()) as { data?: Array<{ id: string; text: string; created_at?: string }> };
    return (body.data ?? []).map((t) => ({
      id: t.id,
      text: t.text,
      createdAt: t.created_at ?? new Date().toISOString(),
    }));
  }
}

function npubToHex(npub: string): string | undefined {
  try {
    const decoded = bech32.decode(npub, 90);
    if (decoded.prefix !== 'npub') {
      return undefined;
    }
    const bytes = Buffer.from(bech32.fromWords(decoded.words));
    return bytes.toString('hex');
  } catch {
    return undefined;
  }
}

export class HttpNostrPort implements NostrPort {
  constructor(private readonly relays: string[] = ['wss://relay.damus.io', 'wss://nos.lol']) {}

  async pollNpub(npub: string): Promise<Array<{ id: string; text: string; createdAt: string }>> {
    const hex = npubToHex(npub);
    if (!hex) {
      return [];
    }
    const relays = this.relays.length ? this.relays : ['wss://relay.damus.io', 'wss://nos.lol'];
    for (const url of relays) {
      try {
        const notes = await pollRelay(url, hex);
        if (notes.length) {
          return notes;
        }
      } catch {
        /* try the next public relay */
      }
    }
    return [];
  }
}

function pollRelay(url: string, authorHex: string): Promise<Array<{ id: string; text: string; createdAt: string }>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const notes: Array<{ id: string; text: string; createdAt: string }> = [];
    const timer = setTimeout(() => {
      ws.close();
      resolve(notes);
    }, 4000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['REQ', 'radar', { authors: [authorHex], kinds: [1], limit: 10 }]));
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as unknown;
        if (!Array.isArray(msg) || msg[0] !== 'EVENT' || !msg[2] || typeof msg[2] !== 'object') {
          if (Array.isArray(msg) && msg[0] === 'EOSE') {
            clearTimeout(timer);
            ws.close();
            resolve(notes);
          }
          return;
        }
        const evnt = msg[2] as { id?: string; content?: string; created_at?: number };
        if (evnt.id && evnt.content) {
          notes.push({
            id: evnt.id,
            text: evnt.content,
            createdAt: new Date((evnt.created_at ?? 0) * 1000).toISOString(),
          });
        }
      } catch {
        /* skip */
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('nostr relay'));
    });
  });
}

export class HttpRssPort implements RssPort {
  async pollUrl(url: string): Promise<Array<{ id: string; title: string; summary: string }>> {
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const text = await res.text();
    const items: Array<{ id: string; title: string; summary: string }> = [];
    const rss = /<item>[\s\S]*?<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = rss.exec(text))) {
      items.push(parseFeedBlock(m[0], 'title', 'guid', 'description'));
    }
    const atom = /<entry>[\s\S]*?<\/entry>/gi;
    while ((m = atom.exec(text))) {
      items.push(parseFeedBlock(m[0], 'title', 'id', 'summary'));
    }
    return items.filter((i) => i.id || i.title);
  }
}

function parseFeedBlock(block: string, titleTag: string, idTag: string, summaryTag: string): {
  id: string;
  title: string;
  summary: string;
} {
  const title = inner(block, titleTag);
  const id = inner(block, idTag) || title;
  const summary = inner(block, summaryTag) || title;
  return { id, title, summary };
}

function inner(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return (m?.[1] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
}
