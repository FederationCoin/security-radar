import type {
  BipRow,
  DistantFeedEventDto,
  EventPage,
  GitHubRepositoryRow,
  HourlyScanRunRow,
  MaintainerRow,
  MergeIngestRunRow,
  PublicEventDto,
  QuantumClockPublic,
  ScanContextRow,
  TaskRow,
  UpstreamRow,
} from '../domain/types';

export type OrgRepoObservation = {
  defaultBranch: string;
  isPrivate: boolean;
};

export interface IntelStore {
  ping(): Promise<void>;
  migrate(): Promise<void>;

  insertScanContext(name: string): Promise<ScanContextRow>;
  listScanContexts(): Promise<ScanContextRow[]>;
  getScanContext(id: string): Promise<ScanContextRow | undefined>;
  trackRepo(scanContextId: string, githubRepositoryId: string): Promise<void>;
  getTrackedRepo(scanContextId: string): Promise<GitHubRepositoryRow | undefined>;
  followsUpstream(scanContextId: string, upstreamId: string): Promise<void>;
  listContextFollowsUpstream(): Promise<Array<{ scanContextId: string; upstreamId: string }>>;

  upsertGitHubRepository(owner: string, name: string): Promise<GitHubRepositoryRow>;
  listGitHubRepositories(): Promise<GitHubRepositoryRow[]>;
  insertRepoObserved(
    repoId: string,
    hourlyScanRunId: string,
    observation: OrgRepoObservation,
  ): Promise<void>;

  upsertUpstream(name: string, mainline: string): Promise<UpstreamRow>;
  getUpstream(id: string): Promise<UpstreamRow | undefined>;
  insertUpstreamObserved(
    upstreamId: string,
    hourlyScanRunId: string,
    tip: string,
    depChurn: number,
    publicMaintainerCount: number,
  ): Promise<void>;
  latestUpstreamObservedAt(upstreamId: string): Promise<string | undefined>;

  ensureMaintainer(p2wpkh: string): Promise<MaintainerRow>;
  getMaintainerByWallet(p2wpkh: string): Promise<MaintainerRow | undefined>;

  listBips(): Promise<BipRow[]>;
  upsertBip(row: Omit<BipRow, 'id'> & { id?: string }): Promise<BipRow>;
  getBip(id: string): Promise<BipRow | undefined>;
  reviewBip(
    maintainerId: string,
    bipId: string,
    review: {
      understanding: string;
      applicability: string;
      honor?: boolean;
      implement?: boolean;
    },
    at: string,
  ): Promise<void>;
  bipReviewedBy(bipId: string, maintainerId: string): Promise<boolean>;

  insertHourlyScanRun(): Promise<HourlyScanRunRow>;
  insertMergeIngestRun(scanContextId: string, githubRunId: string): Promise<MergeIngestRunRow>;
  latestMergeIngestRun(scanContextId: string): Promise<MergeIngestRunRow | undefined>;
  latestHourlyScanRun(): Promise<HourlyScanRunRow | undefined>;

  upsertMissingScanContextEvent(githubOwnerName: string, githubRepositoryId: string): Promise<string>;
  observeMissingContext(eventId: string, hourlyScanRunId: string): Promise<void>;
  missingContextPresent(eventId: string): Promise<boolean>;

  upsertMissingOrgRepoEvent(scanContextId: string, missingName: string): Promise<string>;
  observeMissingRepo(eventId: string, hourlyScanRunId: string): Promise<void>;
  missingRepoPresent(eventId: string): Promise<boolean>;

  upsertMissingDepScanEvent(scanContextId: string): Promise<string>;
  upsertDependencyVulnEvent(
    scanContextId: string,
    packageIdentity: string,
    vulnKey: string,
  ): Promise<string>;
  observeDepVuln(
    eventId: string,
    mergeIngestRunId: string,
    projectVersion: string,
    resolvedDepVersion: string,
  ): Promise<void>;
  depVulnIsPresent(eventId: string): Promise<boolean>;

  upsertUpstreamMainlineEvent(
    scanContextId: string,
    upstreamId: string,
    commit: string,
    title: string,
  ): Promise<string>;
  upsertBipArrivedEvent(bipId: string): Promise<string>;
  upsertStaleUpstreamEvent(upstreamId: string): Promise<string>;
  upsertDistantFeedEvent(
    feedSourceId: string,
    sourceNativeId: string,
    title: string,
    summary: string,
  ): Promise<string>;
  upsertPolledFeedSource(id: string, name: string, ackCadence: string): Promise<void>;

  ackDistant(maintainerId: string, eventId: string, at: string): Promise<void>;
  isDistantAcked(eventId: string): Promise<boolean>;

  insertTask(title: string, eventId: string): Promise<TaskRow>;
  getTask(id: string): Promise<TaskRow | undefined>;
  acceptTask(maintainerId: string, taskId: string, at: string): Promise<void>;
  completeTask(maintainerId: string, taskId: string, at: string): Promise<void>;
  openTaskForEvent(eventId: string): Promise<TaskRow | undefined>;
  listTasks(): Promise<Array<{ id: string; title: string; complete: boolean; eventId?: string }>>;
  taskCompleteForEvent(eventId: string): Promise<boolean>;

  recordHumanAssessment(eventId: string, writeup: string): Promise<string>;
  recordNoForkAssessment(eventId: string, writeup: string): Promise<string>;
  recordSoftForkAssessment(eventId: string, writeup: string): Promise<string>;
  recordHardForkAssessment(eventId: string, writeup: string): Promise<string>;
  addEventBucket(eventId: string, kind: string): Promise<void>;
  bucketsFor(eventId: string): Promise<string[]>;
  hasProducerAssessment(eventId: string): Promise<boolean>;
  hasForkAssessment(eventId: string): Promise<boolean>;

  getQuantumClock(): Promise<QuantumClockPublic | undefined>;
  seedQuantumClock(clock: QuantumClockPublic): Promise<void>;

  getEvent(id: string): Promise<PublicEventDto | undefined>;
  listPublicEvents(cursor?: string): Promise<EventPage>;
  listUnackedDistant(): Promise<DistantFeedEventDto[]>;

  listDependencyVulnEventIds(): Promise<string[]>;
  listMissingScanContextEventIds(): Promise<string[]>;
  listMissingOrgRepoEventIds(): Promise<string[]>;
  listUpstreamMainlineEventIds(): Promise<string[]>;
  listBipIds(): Promise<string[]>;
  listDistantEventIds(): Promise<string[]>;
}
