import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenIntelStore } from '../domain/constants';
import type { IntelStore } from '../ports/intel-store';

@Injectable()
export class ReconcileScanContexts {
  private readonly log = new Logger(ReconcileScanContexts.name);

  constructor(@Inject(TokenIntelStore) private readonly intel: IntelStore) {}

  async run(hourlyScanRunId: string): Promise<void> {
    const repos = await this.intel.listGitHubRepositories();
    const contexts = await this.intel.listScanContexts();
    const tracked = new Set<string>();
    for (const ctx of contexts) {
      const repo = await this.intel.getTrackedRepo(ctx.id);
      if (repo) {
        tracked.add(`${repo.owner}/${repo.name}`);
        const stillThere = repos.some((r) => r.owner === repo.owner && r.name === repo.name);
        if (!stillThere) {
          const eventId = await this.intel.upsertMissingOrgRepoEvent(ctx.id, `${repo.owner}/${repo.name}`);
          await this.intel.observeMissingRepo(eventId, hourlyScanRunId);
          if (!(await this.intel.openTaskForEvent(eventId))) {
            await this.intel.insertTask(`Missing org repo for ${ctx.name}`, eventId);
          }
        }
      }
    }
    for (const repo of repos) {
      const key = `${repo.owner}/${repo.name}`;
      if (!tracked.has(key)) {
        const ctx = await this.intel.insertScanContext(repo.name);
        await this.intel.trackRepo(ctx.id, repo.id);
        tracked.add(key);
      }
    }
    const prefix = 'Create ScanContext for ';
    for (const task of await this.intel.listTasks()) {
      if (task.complete || !task.title.startsWith(prefix)) {
        continue;
      }
      if (tracked.has(task.title.slice(prefix.length))) {
        await this.intel.markTaskComplete(task.id);
      }
    }
    this.log.log('ReconcileScanContexts finished');
  }
}
