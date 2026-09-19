import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenCollectorSettings, TokenIntelStore, TokenNostr, TokenRss, TokenX } from '../domain/constants';
import type { NostrPort, RssPort, XPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import type { CollectorSettings } from '../ports/secret-store';
import { isConfigured, UnconfiguredPort } from '../infra/optional-port';

@Injectable()
export class CollectDistantFeeds {
  private readonly log = new Logger(CollectDistantFeeds.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenX) private readonly x: XPort | UnconfiguredPort,
    @Inject(TokenNostr) private readonly nostr: NostrPort | UnconfiguredPort,
    @Inject(TokenRss) private readonly rss: RssPort | UnconfiguredPort,
    @Inject(TokenCollectorSettings) private readonly settings: CollectorSettings,
  ) {}

  async run(): Promise<void> {
    await this.pollX();
    await this.pollNostr();
    await this.pollRss();
  }

  private async pollX(): Promise<void> {
    if (!isConfigured(this.x)) {
      this.log.warn('skip PollFeed X: XPort unconfigured');
      return;
    }
    await this.intel.upsertPolledFeedSource('x', 'X', 'weekly');
    for (const handle of this.settings.xHandles) {
      const posts = await this.x.pollHandle(handle);
      for (const post of posts) {
        await this.intel.upsertDistantFeedEvent('x', `${handle}:${post.id}`, handle, post.text);
      }
    }
  }

  private async pollNostr(): Promise<void> {
    if (!isConfigured(this.nostr)) {
      this.log.warn('skip PollFeed Nostr: NostrPort unconfigured');
      return;
    }
    await this.intel.upsertPolledFeedSource('nostr', 'Nostr', 'weekly');
    for (const npub of this.settings.nostrNpubs) {
      const notes = await this.nostr.pollNpub(npub);
      for (const note of notes) {
        await this.intel.upsertDistantFeedEvent('nostr', `${npub}:${note.id}`, npub, note.text);
      }
    }
  }

  private async pollRss(): Promise<void> {
    if (!isConfigured(this.rss)) {
      this.log.warn('skip PollFeed RSS: RssPort unconfigured');
      return;
    }
    await this.intel.upsertPolledFeedSource('rss', 'RSS', 'weekly');
    for (const url of this.settings.rssUrls) {
      const items = await this.rss.pollUrl(url);
      for (const item of items) {
        await this.intel.upsertDistantFeedEvent('rss', `${url}:${item.id}`, item.title, item.summary);
      }
    }
  }
}
