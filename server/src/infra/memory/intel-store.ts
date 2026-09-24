import { randomUUID } from 'node:crypto';
import { FindPageSize } from '../../domain/constants';
import { honorNotesFromFlags, withEventDisplay } from '../../domain/event-display';
import { RadarProblem } from '../../domain/types';
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
} from '../../domain/types';
import type { IntelStore, OrgRepoObservation } from '../../ports/intel-store';

function nowIso(): string {
  return new Date().toISOString();
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt, i: id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { t: string; i: string } {
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { t: string; i: string };
    if (typeof raw.t === 'string' && typeof raw.i === 'string') {
      return raw;
    }
  } catch {
    /* invalid */
  }
  throw new RadarProblem(400, 'unknownField', 'cursor is not a FindCursor');
}

function afterCursor(createdAt: string, id: string, cur: { t: string; i: string }): boolean {
  if (createdAt < cur.t) {
    return true;
  }
  if (createdAt === cur.t && id < cur.i) {
    return true;
  }
  return false;
}

export class MemoryIntelStore implements IntelStore {
  private readonly scanContexts = new Map<string, ScanContextRow>();
  private readonly repos = new Map<string, GitHubRepositoryRow>();
  private readonly contextTracksRepo = new Map<string, string>();
  private readonly contextFollowsUpstream: Array<{ scanContextId: string; upstreamId: string }> = [];
  private readonly upstreams = new Map<string, UpstreamRow>();
  private readonly maintainers = new Map<string, MaintainerRow>();
  private readonly bips = new Map<string, BipRow>();
  private readonly bipReviews = new Set<string>();
  private readonly hourlyRuns: HourlyScanRunRow[] = [];
  private readonly mergeRuns: MergeIngestRunRow[] = [];
  private readonly missingContext = new Map<
    string,
    { id: string; createdAt: string; githubOwnerName: string; githubRepositoryId: string }
  >();
  private readonly missingContextByRepo = new Map<string, string>();
  private readonly missingContextObs = new Set<string>();
  private readonly missingOrg = new Map<
    string,
    { id: string; createdAt: string; scanContextId: string; missingName: string }
  >();
  private readonly missingOrgByCtx = new Map<string, string>();
  private readonly missingOrgObs = new Set<string>();
  private readonly missingDep = new Map<string, { id: string; createdAt: string; scanContextId: string }>();
  private readonly missingDepByCtx = new Map<string, string>();
  private readonly depVuln = new Map<
    string,
    { id: string; createdAt: string; scanContextId: string; packageIdentity: string; vulnKey: string }
  >();
  private readonly depVulnByKey = new Map<string, string>();
  private readonly depVulnObs = new Set<string>();
  private readonly upstreamMainline = new Map<
    string,
    { id: string; createdAt: string; scanContextId: string; upstreamId: string; commit: string; title: string }
  >();
  private readonly upstreamMainlineByKey = new Map<string, string>();
  private readonly bipArrived = new Map<string, { id: string; createdAt: string; bipId: string }>();
  private readonly bipArrivedByBip = new Map<string, string>();
  private readonly staleUpstream = new Map<string, { id: string; createdAt: string; upstreamId: string }>();
  private readonly staleByUpstream = new Map<string, string>();
  private readonly distant = new Map<
    string,
    {
      id: string;
      createdAt: string;
      feedSourceId: string;
      sourceNativeId: string;
      title: string;
      summary: string;
    }
  >();
  private readonly distantByKey = new Map<string, string>();
  private readonly distantAcks = new Set<string>();
  private readonly tasks = new Map<string, TaskRow>();
  private readonly taskAccept = new Set<string>();
  private readonly buckets = new Map<string, Set<string>>();
  private readonly humanAssess = new Set<string>();
  private readonly forkAssess = new Set<string>();
  private readonly upstreamObservedAt = new Map<string, string>();
  private clock?: QuantumClockPublic;
  private readonly polledFeeds = new Map<string, { name: string; ackCadence: string }>();

  async ping(): Promise<void> {
    return;
  }

  async migrate(): Promise<void> {
    return;
  }

  async insertScanContext(name: string): Promise<ScanContextRow> {
    const row: ScanContextRow = { id: randomUUID(), name, createdAt: nowIso() };
    this.scanContexts.set(row.id, row);
    return row;
  }

  async listScanContexts(): Promise<ScanContextRow[]> {
    return [...this.scanContexts.values()];
  }

  async getScanContext(id: string): Promise<ScanContextRow | undefined> {
    return this.scanContexts.get(id);
  }

  async trackRepo(scanContextId: string, githubRepositoryId: string): Promise<void> {
    this.contextTracksRepo.set(scanContextId, githubRepositoryId);
  }

  async getTrackedRepo(scanContextId: string): Promise<GitHubRepositoryRow | undefined> {
    const id = this.contextTracksRepo.get(scanContextId);
    return id ? this.repos.get(id) : undefined;
  }

  async followsUpstream(scanContextId: string, upstreamId: string): Promise<void> {
    if (!this.contextFollowsUpstream.some((r) => r.scanContextId === scanContextId && r.upstreamId === upstreamId)) {
      this.contextFollowsUpstream.push({ scanContextId, upstreamId });
    }
  }

  async listContextFollowsUpstream(): Promise<Array<{ scanContextId: string; upstreamId: string }>> {
    return [...this.contextFollowsUpstream];
  }

  async upsertGitHubRepository(owner: string, name: string): Promise<GitHubRepositoryRow> {
    const key = `${owner}/${name}`;
    for (const row of this.repos.values()) {
      if (`${row.owner}/${row.name}` === key) {
        return row;
      }
    }
    const row: GitHubRepositoryRow = { id: randomUUID(), owner, name };
    this.repos.set(row.id, row);
    return row;
  }

  async listGitHubRepositories(): Promise<GitHubRepositoryRow[]> {
    return [...this.repos.values()];
  }

  async insertRepoObserved(
    _repoId: string,
    _hourlyScanRunId: string,
    _observation: OrgRepoObservation,
  ): Promise<void> {
    return;
  }

  async upsertUpstream(name: string, mainline: string): Promise<UpstreamRow> {
    for (const row of this.upstreams.values()) {
      if (row.name === name) {
        return row;
      }
    }
    const row: UpstreamRow = { id: randomUUID(), name, mainline };
    this.upstreams.set(row.id, row);
    return row;
  }

  async getUpstream(id: string): Promise<UpstreamRow | undefined> {
    return this.upstreams.get(id);
  }

  async insertUpstreamObserved(
    upstreamId: string,
    _hourlyScanRunId: string,
    _tip: string,
    _depChurn: number,
    _publicMaintainerCount: number,
  ): Promise<void> {
    this.upstreamObservedAt.set(upstreamId, nowIso());
  }

  async latestUpstreamObservedAt(upstreamId: string): Promise<string | undefined> {
    return this.upstreamObservedAt.get(upstreamId);
  }

  async ensureMaintainer(p2wpkh: string): Promise<MaintainerRow> {
    const existing = [...this.maintainers.values()].find((m) => m.p2wpkh === p2wpkh);
    if (existing) {
      return existing;
    }
    const row: MaintainerRow = { id: randomUUID(), p2wpkh };
    this.maintainers.set(row.id, row);
    return row;
  }

  async getMaintainerByWallet(p2wpkh: string): Promise<MaintainerRow | undefined> {
    return [...this.maintainers.values()].find((m) => m.p2wpkh === p2wpkh);
  }

  async listBips(): Promise<BipRow[]> {
    return [...this.bips.values()].sort((a, b) => a.number - b.number);
  }

  async upsertBip(row: Omit<BipRow, 'id'> & { id?: string }): Promise<BipRow> {
    for (const existing of this.bips.values()) {
      if (existing.number === row.number) {
        const merged = { ...existing, ...row, id: existing.id };
        this.bips.set(existing.id, merged);
        return merged;
      }
    }
    const created: BipRow = { ...row, id: row.id ?? randomUUID() };
    this.bips.set(created.id, created);
    return created;
  }

  async getBip(id: string): Promise<BipRow | undefined> {
    return this.bips.get(id);
  }

  async reviewBip(
    maintainerId: string,
    bipId: string,
    review: {
      understanding: string;
      applicability: string;
      honor?: boolean;
      implement?: boolean;
    },
    _at: string,
  ): Promise<void> {
    this.bipReviews.add(`${maintainerId}:${bipId}`);
    const existing = this.bips.get(bipId);
    if (existing) {
      this.bips.set(bipId, {
        ...existing,
        whatItDoes: review.understanding,
        howItHitsUs: review.applicability,
        honorNotes: honorNotesFromFlags(review.honor, review.implement),
      });
    }
  }

  async bipReviewedBy(bipId: string, maintainerId: string): Promise<boolean> {
    return this.bipReviews.has(`${maintainerId}:${bipId}`);
  }

  async insertHourlyScanRun(): Promise<HourlyScanRunRow> {
    const row: HourlyScanRunRow = { id: randomUUID(), createdAt: nowIso() };
    this.hourlyRuns.push(row);
    return row;
  }

  async insertMergeIngestRun(scanContextId: string, githubRunId: string): Promise<MergeIngestRunRow> {
    const row: MergeIngestRunRow = {
      id: randomUUID(),
      scanContextId,
      githubRunId,
      createdAt: nowIso(),
    };
    this.mergeRuns.push(row);
    return row;
  }

  async latestMergeIngestRun(scanContextId: string): Promise<MergeIngestRunRow | undefined> {
    return [...this.mergeRuns].filter((r) => r.scanContextId === scanContextId).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    )[0];
  }

  async latestHourlyScanRun(): Promise<HourlyScanRunRow | undefined> {
    return this.hourlyRuns[this.hourlyRuns.length - 1];
  }

  async upsertMissingScanContextEvent(githubOwnerName: string, githubRepositoryId: string): Promise<string> {
    const existing = this.missingContextByRepo.get(githubRepositoryId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.missingContext.set(id, { id, createdAt: nowIso(), githubOwnerName, githubRepositoryId });
    this.missingContextByRepo.set(githubRepositoryId, id);
    return id;
  }

  async observeMissingContext(eventId: string, hourlyScanRunId: string): Promise<void> {
    this.missingContextObs.add(`${eventId}:${hourlyScanRunId}`);
  }

  async missingContextPresent(eventId: string): Promise<boolean> {
    const latest = await this.latestHourlyScanRun();
    if (!latest) {
      return true;
    }
    return this.missingContextObs.has(`${eventId}:${latest.id}`);
  }

  async upsertMissingOrgRepoEvent(scanContextId: string, missingName: string): Promise<string> {
    const existing = this.missingOrgByCtx.get(scanContextId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.missingOrg.set(id, { id, createdAt: nowIso(), scanContextId, missingName });
    this.missingOrgByCtx.set(scanContextId, id);
    return id;
  }

  async observeMissingRepo(eventId: string, hourlyScanRunId: string): Promise<void> {
    this.missingOrgObs.add(`${eventId}:${hourlyScanRunId}`);
  }

  async missingRepoPresent(eventId: string): Promise<boolean> {
    const latest = await this.latestHourlyScanRun();
    if (!latest) {
      return true;
    }
    return this.missingOrgObs.has(`${eventId}:${latest.id}`);
  }

  async upsertMissingDepScanEvent(scanContextId: string): Promise<string> {
    const existing = this.missingDepByCtx.get(scanContextId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.missingDep.set(id, { id, createdAt: nowIso(), scanContextId });
    this.missingDepByCtx.set(scanContextId, id);
    return id;
  }

  async upsertDependencyVulnEvent(
    scanContextId: string,
    packageIdentity: string,
    vulnKey: string,
  ): Promise<string> {
    const key = `${scanContextId}:${packageIdentity}:${vulnKey}`;
    const existing = this.depVulnByKey.get(key);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.depVuln.set(id, { id, createdAt: nowIso(), scanContextId, packageIdentity, vulnKey });
    this.depVulnByKey.set(key, id);
    return id;
  }

  async observeDepVuln(
    eventId: string,
    mergeIngestRunId: string,
    _projectVersion: string,
    _resolvedDepVersion: string,
  ): Promise<void> {
    this.depVulnObs.add(`${eventId}:${mergeIngestRunId}`);
  }

  async depVulnIsPresent(eventId: string): Promise<boolean> {
    const ev = this.depVuln.get(eventId);
    if (!ev) {
      return false;
    }
    const latest = await this.latestMergeIngestRun(ev.scanContextId);
    if (!latest) {
      return true;
    }
    return this.depVulnObs.has(`${eventId}:${latest.id}`);
  }

  async upsertUpstreamMainlineEvent(
    scanContextId: string,
    upstreamId: string,
    commit: string,
    title: string,
  ): Promise<string> {
    const key = `${scanContextId}:${upstreamId}:${commit}`;
    const existing = this.upstreamMainlineByKey.get(key);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.upstreamMainline.set(id, { id, createdAt: nowIso(), scanContextId, upstreamId, commit, title });
    this.upstreamMainlineByKey.set(key, id);
    return id;
  }

  async upsertBipArrivedEvent(bipId: string): Promise<string> {
    const existing = this.bipArrivedByBip.get(bipId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.bipArrived.set(id, { id, createdAt: nowIso(), bipId });
    this.bipArrivedByBip.set(bipId, id);
    return id;
  }

  async upsertStaleUpstreamEvent(upstreamId: string): Promise<string> {
    const existing = this.staleByUpstream.get(upstreamId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.staleUpstream.set(id, { id, createdAt: nowIso(), upstreamId });
    this.staleByUpstream.set(upstreamId, id);
    return id;
  }

  async upsertDistantFeedEvent(
    feedSourceId: string,
    sourceNativeId: string,
    title: string,
    summary: string,
  ): Promise<string> {
    const key = `${feedSourceId}:${sourceNativeId}`;
    const existing = this.distantByKey.get(key);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.distant.set(id, { id, createdAt: nowIso(), feedSourceId, sourceNativeId, title, summary });
    this.distantByKey.set(key, id);
    return id;
  }

  async upsertPolledFeedSource(id: string, name: string, ackCadence: string): Promise<void> {
    this.polledFeeds.set(id, { name, ackCadence });
  }

  async ackDistant(maintainerId: string, eventId: string, _at: string): Promise<void> {
    if (!this.distant.has(eventId)) {
      throw new RadarProblem(404, 'notFound', 'Distant event not found');
    }
    this.distantAcks.add(`${maintainerId}:${eventId}`);
  }

  async isDistantAcked(eventId: string): Promise<boolean> {
    for (const key of this.distantAcks) {
      if (key.endsWith(`:${eventId}`)) {
        return true;
      }
    }
    return false;
  }

  async insertTask(title: string, eventId: string): Promise<TaskRow> {
    const row: TaskRow = { id: randomUUID(), title, createdAt: nowIso(), eventId };
    this.tasks.set(row.id, row);
    return row;
  }

  async getTask(id: string): Promise<TaskRow | undefined> {
    return this.tasks.get(id);
  }

  async acceptTask(maintainerId: string, taskId: string, _at: string): Promise<void> {
    if (!this.tasks.has(taskId)) {
      throw new RadarProblem(404, 'notFound', 'Task not found');
    }
    this.taskAccept.add(`${maintainerId}:${taskId}`);
  }

  async completeTask(maintainerId: string, taskId: string, at: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new RadarProblem(404, 'notFound', 'Task not found');
    }
    this.taskAccept.add(`${maintainerId}:${taskId}`);
    this.tasks.set(taskId, { ...task, completedAt: at });
  }

  async openTaskForEvent(eventId: string): Promise<TaskRow | undefined> {
    return [...this.tasks.values()].find((t) => t.eventId === eventId && !t.completedAt);
  }

  async listTasks(): Promise<Array<{ id: string; title: string; complete: boolean; eventId?: string }>> {
    return [...this.tasks.values()].map((t) => ({
      id: t.id,
      title: t.title,
      complete: Boolean(t.completedAt),
      eventId: t.eventId,
    }));
  }

  async taskCompleteForEvent(eventId: string): Promise<boolean> {
    return [...this.tasks.values()].some((t) => t.eventId === eventId && Boolean(t.completedAt));
  }

  async recordHumanAssessment(eventId: string, _writeup: string): Promise<string> {
    this.assertEventExists(eventId);
    const id = randomUUID();
    this.humanAssess.add(eventId);
    return id;
  }

  async recordNoForkAssessment(eventId: string, _writeup: string): Promise<string> {
    this.assertEventExists(eventId);
    const id = randomUUID();
    this.forkAssess.add(eventId);
    return id;
  }

  async recordSoftForkAssessment(eventId: string, _writeup: string): Promise<string> {
    this.assertEventExists(eventId);
    const id = randomUUID();
    this.forkAssess.add(eventId);
    await this.addEventBucket(eventId, 'ChainForkThreat');
    return id;
  }

  async recordHardForkAssessment(eventId: string, _writeup: string): Promise<string> {
    this.assertEventExists(eventId);
    const id = randomUUID();
    this.forkAssess.add(eventId);
    await this.addEventBucket(eventId, 'ChainForkThreat');
    return id;
  }

  async addEventBucket(eventId: string, kind: string): Promise<void> {
    const set = this.buckets.get(eventId) ?? new Set<string>();
    set.add(kind);
    this.buckets.set(eventId, set);
  }

  async bucketsFor(eventId: string): Promise<string[]> {
    return [...(this.buckets.get(eventId) ?? [])];
  }

  async hasProducerAssessment(eventId: string): Promise<boolean> {
    return this.humanAssess.has(eventId);
  }

  async hasForkAssessment(eventId: string): Promise<boolean> {
    return this.forkAssess.has(eventId);
  }

  async getQuantumClock(): Promise<QuantumClockPublic | undefined> {
    return this.clock;
  }

  async seedQuantumClock(clock: QuantumClockPublic): Promise<void> {
    this.clock = clock;
  }

  async getEvent(id: string): Promise<PublicEventDto | undefined> {
    const dto = await this.toDto(id);
    if (!dto) {
      return undefined;
    }
    if (dto.type === 'DistantFeedEvent' && !dto.acked) {
      return undefined;
    }
    return dto;
  }

  async listPublicEvents(cursor?: string): Promise<EventPage> {
    const all = await this.allDtos();
    const publicItems = all.filter((e) => e.type !== 'DistantFeedEvent' || e.acked);
    return this.page(publicItems, cursor);
  }

  async listUnackedDistant(): Promise<DistantFeedEventDto[]> {
    const all = await this.allDtos();
    return all.filter((e): e is DistantFeedEventDto => e.type === 'DistantFeedEvent' && !e.acked);
  }

  async listDependencyVulnEventIds(): Promise<string[]> {
    return [...this.depVuln.keys()];
  }

  async listMissingScanContextEventIds(): Promise<string[]> {
    return [...this.missingContext.keys()];
  }

  async listMissingOrgRepoEventIds(): Promise<string[]> {
    return [...this.missingOrg.keys()];
  }

  async listUpstreamMainlineEventIds(): Promise<string[]> {
    return [...this.upstreamMainline.keys()];
  }

  async listBipIds(): Promise<string[]> {
    return [...this.bips.keys()];
  }

  async listDistantEventIds(): Promise<string[]> {
    return [...this.distant.keys()];
  }

  private assertEventExists(eventId: string): void {
    if (
      this.missingContext.has(eventId) ||
      this.missingOrg.has(eventId) ||
      this.missingDep.has(eventId) ||
      this.depVuln.has(eventId) ||
      this.upstreamMainline.has(eventId) ||
      this.bipArrived.has(eventId) ||
      this.staleUpstream.has(eventId) ||
      this.distant.has(eventId)
    ) {
      return;
    }
    throw new RadarProblem(404, 'notFound', 'Event not found');
  }

  private page(items: PublicEventDto[], cursor?: string): EventPage {
    const sorted = [...items].sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt < b.createdAt ? 1 : -1;
      }
      return a.id < b.id ? 1 : -1;
    });
    const cur = cursor ? decodeCursor(cursor) : undefined;
    const sliced = cur ? sorted.filter((e) => afterCursor(e.createdAt, e.id, cur)) : sorted;
    const page = sliced.slice(0, FindPageSize);
    const last = page[page.length - 1];
    const next = sliced.length > FindPageSize && last ? encodeCursor(last.createdAt, last.id) : undefined;
    return { items: page, ...(next ? { cursor: next } : {}) };
  }

  private async allDtos(): Promise<PublicEventDto[]> {
    const ids = [
      ...this.missingContext.keys(),
      ...this.missingOrg.keys(),
      ...this.missingDep.keys(),
      ...this.depVuln.keys(),
      ...this.upstreamMainline.keys(),
      ...this.bipArrived.keys(),
      ...this.staleUpstream.keys(),
      ...this.distant.keys(),
    ];
    const out: PublicEventDto[] = [];
    for (const id of ids) {
      const dto = await this.toDto(id);
      if (dto) {
        out.push(dto);
      }
    }
    return out;
  }

  private async toDto(id: string): Promise<PublicEventDto | undefined> {
    const buckets = await this.bucketsFor(id);
    const mc = this.missingContext.get(id);
    if (mc) {
      return withEventDisplay({
        type: 'MissingScanContextEvent',
        id: mc.id,
        createdAt: mc.createdAt,
        githubOwnerName: mc.githubOwnerName,
        present: await this.missingContextPresent(id),
        buckets,
      });
    }
    const mo = this.missingOrg.get(id);
    if (mo) {
      return withEventDisplay({
        type: 'MissingOrgRepoEvent',
        id: mo.id,
        createdAt: mo.createdAt,
        scanContextId: mo.scanContextId,
        missingName: mo.missingName,
        present: await this.missingRepoPresent(id),
        buckets,
      });
    }
    const md = this.missingDep.get(id);
    if (md) {
      return withEventDisplay({
        type: 'MissingDepScanEvent',
        id: md.id,
        createdAt: md.createdAt,
        scanContextId: md.scanContextId,
        buckets,
      });
    }
    const dv = this.depVuln.get(id);
    if (dv) {
      return withEventDisplay({
        type: 'DependencyVulnEvent',
        id: dv.id,
        createdAt: dv.createdAt,
        scanContextId: dv.scanContextId,
        packageIdentity: dv.packageIdentity,
        vulnKey: dv.vulnKey,
        present: await this.depVulnIsPresent(id),
        taskComplete: await this.taskCompleteForEvent(id),
        buckets,
      });
    }
    const um = this.upstreamMainline.get(id);
    if (um) {
      return withEventDisplay({
        type: 'UpstreamMainlineEvent',
        id: um.id,
        createdAt: um.createdAt,
        scanContextId: um.scanContextId,
        upstreamId: um.upstreamId,
        commit: um.commit,
        title: um.title,
        buckets,
      });
    }
    const ba = this.bipArrived.get(id);
    if (ba) {
      const bip = await this.getBip(ba.bipId);
      return withEventDisplay({
        type: 'BipArrivedEvent',
        id: ba.id,
        createdAt: ba.createdAt,
        bipId: ba.bipId,
        bipNumber: bip?.number,
        bipTitle: bip?.title,
        bipSummary: bip?.summary,
        buckets,
      });
    }
    const st = this.staleUpstream.get(id);
    if (st) {
      return withEventDisplay({
        type: 'StaleUpstreamEvent',
        id: st.id,
        createdAt: st.createdAt,
        upstreamId: st.upstreamId,
        buckets,
      });
    }
    const di = this.distant.get(id);
    if (di) {
      return withEventDisplay({
        type: 'DistantFeedEvent',
        id: di.id,
        createdAt: di.createdAt,
        feedSourceId: di.feedSourceId,
        sourceNativeId: di.sourceNativeId,
        title: di.title,
        summary: di.summary,
        acked: await this.isDistantAcked(id),
        buckets,
      });
    }
    return undefined;
  }
}
