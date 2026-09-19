import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenGitHub, TokenIntelStore } from '../domain/constants';
import type { GitHubPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import { isConfigured, UnconfiguredPort } from '../infra/optional-port';

@Injectable()
export class CollectBips {
  private readonly log = new Logger(CollectBips.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenGitHub) private readonly github: GitHubPort | UnconfiguredPort,
  ) {}

  async run(): Promise<void> {
    if (!isConfigured(this.github)) {
      this.log.warn('skip CollectBips: GitHubPort unconfigured');
      return;
    }
    const bips = await this.github.listBips();
    for (const bip of bips) {
      const row = await this.intel.upsertBip({
        number: bip.number,
        title: bip.title,
        summary: bip.summary,
      });
      await this.intel.upsertBipArrivedEvent(row.id);
    }
  }
}
