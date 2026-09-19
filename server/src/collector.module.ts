import { Module } from '@nestjs/common';
import { RadarInfraModule } from './infra/radar-infra.module';
import { CollectorTick } from './collectors/tick';
import { CollectOrgRepos } from './collectors/collect-org-repos';
import { ReconcileScanContexts } from './collectors/reconcile-scan-contexts';
import { IngestDepReports } from './collectors/ingest-dep-reports';
import { CollectUpstreamTips } from './collectors/collect-upstream-tips';
import { CollectBips } from './collectors/collect-bips';
import { CollectDistantFeeds } from './collectors/collect-distant-feeds';
import { OpenTasksForGaps } from './collectors/open-tasks-for-gaps';

@Module({
  imports: [RadarInfraModule],
  providers: [
    CollectOrgRepos,
    ReconcileScanContexts,
    IngestDepReports,
    CollectUpstreamTips,
    CollectBips,
    CollectDistantFeeds,
    OpenTasksForGaps,
    CollectorTick,
  ],
})
export class CollectorModule {}
