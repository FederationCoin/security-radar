import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenGitHub, TokenIntelStore } from '../domain/constants';
import type { GitHubPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import { isConfigured, UnconfiguredPort } from '../infra/optional-port';

const StaleWindowMs = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CollectUpstreamTips {
  private readonly log = new Logger(CollectUpstreamTips.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenGitHub) private readonly github: GitHubPort | UnconfiguredPort,
  ) {}

  async run(hourlyScanRunId: string): Promise<void> {
    if (!isConfigured(this.github)) {
      this.log.warn('skip CollectUpstreamTips: GitHubPort unconfigured');
      return;
    }
    const follows = await this.intel.listContextFollowsUpstream();
    const now = Date.now();
    for (const follow of follows) {
      const upstream = await this.intel.getUpstream(follow.upstreamId);
      if (!upstream) {
        continue;
      }
      const commits = await this.github.listUpstreamCommits(upstream.mainline);
      const tip = commits[0];
      await this.intel.insertUpstreamObserved(
        upstream.id,
        hourlyScanRunId,
        tip?.sha ?? '',
        commits.length,
        0,
      );
      if (tip) {
        await this.intel.upsertUpstreamMainlineEvent(
          follow.scanContextId,
          upstream.id,
          tip.sha,
          tip.message,
        );
      }
      const last = tip ? Date.parse(tip.committedAt) : 0;
      if (!tip || now - last > StaleWindowMs) {
        await this.intel.upsertStaleUpstreamEvent(upstream.id);
      }
    }
  }
}
