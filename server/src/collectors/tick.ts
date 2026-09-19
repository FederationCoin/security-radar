import { Injectable, Logger } from '@nestjs/common';
import { CollectOrgRepos } from './collect-org-repos';
import { ReconcileScanContexts } from './reconcile-scan-contexts';
import { IngestDepReports } from './ingest-dep-reports';
import { CollectUpstreamTips } from './collect-upstream-tips';
import { CollectBips } from './collect-bips';
import { CollectDistantFeeds } from './collect-distant-feeds';
import { OpenTasksForGaps } from './open-tasks-for-gaps';
import { Inject } from '@nestjs/common';
import { TokenIntelStore } from '../domain/constants';
import type { IntelStore } from '../ports/intel-store';

@Injectable()
export class CollectorTick {
  private readonly log = new Logger(CollectorTick.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    private readonly org: CollectOrgRepos,
    private readonly reconcile: ReconcileScanContexts,
    private readonly ingest: IngestDepReports,
    private readonly upstream: CollectUpstreamTips,
    private readonly bips: CollectBips,
    private readonly distant: CollectDistantFeeds,
    private readonly gaps: OpenTasksForGaps,
  ) {}

  async runHourly(): Promise<void> {
    await this.intel.migrate();
    const hourly = await this.intel.insertHourlyScanRun();
    await this.org.run(hourly.id);
    await this.reconcile.run(hourly.id);
    await this.ingest.run();
    await this.upstream.run(hourly.id);
    await this.bips.run();
    await this.distant.run();
    await this.gaps.run();
    this.log.log('hourly tick finished');
  }
}
