import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenGitHub, TokenIntelStore } from '../domain/constants';
import { FederationCoinOrgRepos } from '../domain/constants';
import type { GitHubPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import { isConfigured, UnconfiguredPort } from '../infra/optional-port';

@Injectable()
export class CollectOrgRepos {
  private readonly log = new Logger(CollectOrgRepos.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenGitHub) private readonly github: GitHubPort | UnconfiguredPort,
  ) {}

  async run(hourlyScanRunId: string): Promise<void> {
    if (!isConfigured(this.github)) {
      this.log.warn('skip CollectOrgRepos: GitHubPort unconfigured');
      return;
    }
    const listed = await this.github.listOrgRepos();
    const wanted = new Set<string>(FederationCoinOrgRepos);
    for (const repo of listed) {
      if (!wanted.has(repo.name)) {
        continue;
      }
      const row = await this.intel.upsertGitHubRepository('FederationCoin', repo.name);
      await this.intel.insertRepoObserved(row.id, hourlyScanRunId, {
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.private,
      });
    }
  }
}
