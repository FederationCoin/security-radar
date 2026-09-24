import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
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
import type { MariaSettings } from '../../ports/secret-store';

type SqlBind = Array<string | number | boolean | Date | Buffer | null>;

function nowSql(): string {
  return new Date().toISOString().slice(0, 23).replace('T', ' ');
}

function toIso(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value.includes('T')) {
    return new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();
  }
  return new Date(`${value.replace(' ', 'T')}Z`).toISOString();
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

type Row = Record<string, unknown>;

export class MysqlIntelStore implements IntelStore {
  constructor(private readonly maria: MariaSettings) {}

  private pool?: mysql.Pool;

  private conn(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: this.maria.host,
        user: this.maria.user,
        password: this.maria.password,
        database: this.maria.database,
        port: this.maria.port ?? 3306,
        multipleStatements: true,
        dateStrings: true,
      });
    }
    return this.pool;
  }

  private async q(sql: string, params: SqlBind = []): Promise<Row[]> {
    const [rows] = await this.conn().execute(sql, params);
    return rows as Row[];
  }

  private async exec(sql: string, params: SqlBind = []): Promise<void> {
    await this.conn().execute(sql, params);
  }

  async ping(): Promise<void> {
    await this.conn().query('SELECT 1');
  }

  async migrate(): Promise<void> {
    const sql = await readFile(join(process.cwd(), 'migrations/001_init.sql'), 'utf8');
    await this.conn().query(sql);
  }

  async insertScanContext(name: string): Promise<ScanContextRow> {
    const row: ScanContextRow = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    await this.exec('INSERT INTO scan_context (id, name, created_at) VALUES (?, ?, ?)', [
      row.id,
      row.name,
      nowSql(),
    ]);
    return row;
  }

  async listScanContexts(): Promise<ScanContextRow[]> {
    const rows = await this.q('SELECT id, name, created_at FROM scan_context');
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      createdAt: toIso(String(r.created_at)),
    }));
  }

  async getScanContext(id: string): Promise<ScanContextRow | undefined> {
    const rows = await this.q('SELECT id, name, created_at FROM scan_context WHERE id = ?', [id]);
    const r = rows[0];
    return r
      ? { id: String(r.id), name: String(r.name), createdAt: toIso(String(r.created_at)) }
      : undefined;
  }

  async trackRepo(scanContextId: string, githubRepositoryId: string): Promise<void> {
    await this.exec(
      'INSERT IGNORE INTO context_tracks_repo (scan_context_id, github_repository_id) VALUES (?, ?)',
      [scanContextId, githubRepositoryId],
    );
  }

  async getTrackedRepo(scanContextId: string): Promise<GitHubRepositoryRow | undefined> {
    const rows = await this.q(
      `SELECT r.id, r.owner, r.name FROM github_repository r
       INNER JOIN context_tracks_repo x ON x.github_repository_id = r.id
       WHERE x.scan_context_id = ? LIMIT 1`,
      [scanContextId],
    );
    const r = rows[0];
    return r ? { id: String(r.id), owner: String(r.owner), name: String(r.name) } : undefined;
  }

  async followsUpstream(scanContextId: string, upstreamId: string): Promise<void> {
    await this.exec(
      'INSERT IGNORE INTO context_follows_upstream (scan_context_id, upstream_id) VALUES (?, ?)',
      [scanContextId, upstreamId],
    );
  }

  async listContextFollowsUpstream(): Promise<Array<{ scanContextId: string; upstreamId: string }>> {
    const rows = await this.q('SELECT scan_context_id, upstream_id FROM context_follows_upstream');
    return rows.map((r) => ({
      scanContextId: String(r.scan_context_id),
      upstreamId: String(r.upstream_id),
    }));
  }

  async upsertGitHubRepository(owner: string, name: string): Promise<GitHubRepositoryRow> {
    const found = await this.q('SELECT id, owner, name FROM github_repository WHERE owner = ? AND name = ?', [
      owner,
      name,
    ]);
    if (found[0]) {
      return { id: String(found[0].id), owner: String(found[0].owner), name: String(found[0].name) };
    }
    const row: GitHubRepositoryRow = { id: randomUUID(), owner, name };
    await this.exec('INSERT INTO github_repository (id, owner, name) VALUES (?, ?, ?)', [row.id, owner, name]);
    return row;
  }

  async listGitHubRepositories(): Promise<GitHubRepositoryRow[]> {
    const rows = await this.q('SELECT id, owner, name FROM github_repository');
    return rows.map((r) => ({ id: String(r.id), owner: String(r.owner), name: String(r.name) }));
  }

  async insertRepoObserved(
    repoId: string,
    hourlyScanRunId: string,
    observation: OrgRepoObservation,
  ): Promise<void> {
    await this.exec(
      `INSERT INTO repo_observed (github_repository_id, hourly_scan_run_id, default_branch, is_private)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE default_branch = VALUES(default_branch), is_private = VALUES(is_private)`,
      [repoId, hourlyScanRunId, observation.defaultBranch, observation.isPrivate ? 1 : 0],
    );
  }

  async upsertUpstream(name: string, mainline: string): Promise<UpstreamRow> {
    const found = await this.q('SELECT id, name, mainline FROM upstream_peer WHERE name = ?', [name]);
    if (found[0]) {
      return { id: String(found[0].id), name: String(found[0].name), mainline: String(found[0].mainline) };
    }
    const row: UpstreamRow = { id: randomUUID(), name, mainline };
    await this.exec('INSERT INTO upstream_peer (id, name, mainline) VALUES (?, ?, ?)', [row.id, name, mainline]);
    return row;
  }

  async getUpstream(id: string): Promise<UpstreamRow | undefined> {
    const rows = await this.q('SELECT id, name, mainline FROM upstream_peer WHERE id = ?', [id]);
    const r = rows[0];
    return r ? { id: String(r.id), name: String(r.name), mainline: String(r.mainline) } : undefined;
  }

  async insertUpstreamObserved(
    upstreamId: string,
    hourlyScanRunId: string,
    tip: string,
    depChurn: number,
    publicMaintainerCount: number,
  ): Promise<void> {
    await this.exec(
      `INSERT INTO upstream_observed (upstream_id, hourly_scan_run_id, tip, dep_churn, public_maintainer_count)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tip = VALUES(tip), dep_churn = VALUES(dep_churn),
         public_maintainer_count = VALUES(public_maintainer_count)`,
      [upstreamId, hourlyScanRunId, tip, depChurn, publicMaintainerCount],
    );
  }

  async latestUpstreamObservedAt(upstreamId: string): Promise<string | undefined> {
    const rows = await this.q(
      `SELECT r.created_at FROM upstream_observed o
       INNER JOIN hourly_scan_run r ON r.id = o.hourly_scan_run_id
       WHERE o.upstream_id = ? ORDER BY r.created_at DESC LIMIT 1`,
      [upstreamId],
    );
    return rows[0] ? toIso(String(rows[0].created_at)) : undefined;
  }

  async ensureMaintainer(p2wpkh: string): Promise<MaintainerRow> {
    const found = await this.q('SELECT id, p2wpkh FROM maintainer WHERE p2wpkh = ?', [p2wpkh]);
    if (found[0]) {
      return { id: String(found[0].id), p2wpkh: String(found[0].p2wpkh) };
    }
    const row: MaintainerRow = { id: randomUUID(), p2wpkh };
    await this.exec('INSERT INTO maintainer (id, p2wpkh) VALUES (?, ?)', [row.id, p2wpkh]);
    return row;
  }

  async getMaintainerByWallet(p2wpkh: string): Promise<MaintainerRow | undefined> {
    const rows = await this.q('SELECT id, p2wpkh FROM maintainer WHERE p2wpkh = ?', [p2wpkh]);
    const r = rows[0];
    return r ? { id: String(r.id), p2wpkh: String(r.p2wpkh) } : undefined;
  }

  async listBips(): Promise<BipRow[]> {
    const rows = await this.q(
      'SELECT id, number, title, summary, what_it_does, how_it_hits_us, honor_notes, ethos_notes FROM bip ORDER BY number',
    );
    return rows.map((r) => this.bipFromRow(r));
  }

  async upsertBip(row: Omit<BipRow, 'id'> & { id?: string }): Promise<BipRow> {
    const found = await this.q(
      'SELECT id, number, title, summary, what_it_does, how_it_hits_us, honor_notes, ethos_notes FROM bip WHERE number = ?',
      [row.number],
    );
    if (found[0]) {
      await this.exec(
        `UPDATE bip SET title = ?, summary = ?, what_it_does = ?, how_it_hits_us = ?, honor_notes = ?, ethos_notes = ?
         WHERE id = ?`,
        [
          row.title,
          row.summary,
          row.whatItDoes ?? null,
          row.howItHitsUs ?? null,
          row.honorNotes ?? null,
          row.ethosNotes ?? null,
          String(found[0].id),
        ],
      );
      return this.bipFromRow({ ...found[0], title: row.title, summary: row.summary });
    }
    const created: BipRow = { ...row, id: row.id ?? randomUUID() };
    await this.exec(
      `INSERT INTO bip (id, number, title, summary, what_it_does, how_it_hits_us, honor_notes, ethos_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.number,
        created.title,
        created.summary,
        created.whatItDoes ?? null,
        created.howItHitsUs ?? null,
        created.honorNotes ?? null,
        created.ethosNotes ?? null,
      ],
    );
    return created;
  }

  async getBip(id: string): Promise<BipRow | undefined> {
    const rows = await this.q(
      'SELECT id, number, title, summary, what_it_does, how_it_hits_us, honor_notes, ethos_notes FROM bip WHERE id = ?',
      [id],
    );
    return rows[0] ? this.bipFromRow(rows[0]) : undefined;
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
    at: string,
  ): Promise<void> {
    const notes = `${review.understanding}\n\n${review.applicability}`;
    await this.exec(
      `INSERT INTO maintainer_reviews_bip (maintainer_id, bip_id, notes, reviewed_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE notes = VALUES(notes), reviewed_at = VALUES(reviewed_at)`,
      [maintainerId, bipId, notes, at.slice(0, 23).replace('T', ' ').replace('Z', '')],
    );
    await this.exec(
      `UPDATE bip SET what_it_does = ?, how_it_hits_us = ?, honor_notes = ? WHERE id = ?`,
      [
        review.understanding,
        review.applicability,
        honorNotesFromFlags(review.honor, review.implement) ?? null,
        bipId,
      ],
    );
  }

  async bipReviewedBy(bipId: string, maintainerId: string): Promise<boolean> {
    const rows = await this.q(
      'SELECT bip_id FROM maintainer_reviews_bip WHERE bip_id = ? AND maintainer_id = ?',
      [bipId, maintainerId],
    );
    return rows.length > 0;
  }

  async insertHourlyScanRun(): Promise<HourlyScanRunRow> {
    const row: HourlyScanRunRow = { id: randomUUID(), createdAt: new Date().toISOString() };
    await this.exec('INSERT INTO hourly_scan_run (id, created_at) VALUES (?, ?)', [row.id, nowSql()]);
    return row;
  }

  async insertMergeIngestRun(scanContextId: string, githubRunId: string): Promise<MergeIngestRunRow> {
    const row: MergeIngestRunRow = {
      id: randomUUID(),
      scanContextId,
      githubRunId,
      createdAt: new Date().toISOString(),
    };
    await this.exec(
      'INSERT INTO merge_ingest_run (id, scan_context_id, github_run_id, created_at) VALUES (?, ?, ?, ?)',
      [row.id, scanContextId, githubRunId, nowSql()],
    );
    return row;
  }

  async latestMergeIngestRun(scanContextId: string): Promise<MergeIngestRunRow | undefined> {
    const rows = await this.q(
      `SELECT id, scan_context_id, github_run_id, created_at FROM merge_ingest_run
       WHERE scan_context_id = ? ORDER BY created_at DESC LIMIT 1`,
      [scanContextId],
    );
    const r = rows[0];
    return r
      ? {
          id: String(r.id),
          scanContextId: String(r.scan_context_id),
          githubRunId: String(r.github_run_id),
          createdAt: toIso(String(r.created_at)),
        }
      : undefined;
  }

  async latestHourlyScanRun(): Promise<HourlyScanRunRow | undefined> {
    const rows = await this.q(
      'SELECT id, created_at FROM hourly_scan_run ORDER BY created_at DESC LIMIT 1',
    );
    const r = rows[0];
    return r ? { id: String(r.id), createdAt: toIso(String(r.created_at)) } : undefined;
  }

  async upsertMissingScanContextEvent(githubOwnerName: string, githubRepositoryId: string): Promise<string> {
    const found = await this.q(
      'SELECT id FROM missing_scan_context_event WHERE github_repository_id = ?',
      [githubRepositoryId],
    );
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO missing_scan_context_event (id, created_at, github_owner_name, github_repository_id) VALUES (?, ?, ?, ?)',
      [id, nowSql(), githubOwnerName, githubRepositoryId],
    );
    return id;
  }

  async observeMissingContext(eventId: string, hourlyScanRunId: string): Promise<void> {
    await this.exec(
      'INSERT IGNORE INTO missing_context_observed (missing_scan_context_event_id, hourly_scan_run_id) VALUES (?, ?)',
      [eventId, hourlyScanRunId],
    );
  }

  async missingContextPresent(eventId: string): Promise<boolean> {
    const latest = await this.latestHourlyScanRun();
    if (!latest) {
      return true;
    }
    const rows = await this.q(
      'SELECT hourly_scan_run_id FROM missing_context_observed WHERE missing_scan_context_event_id = ? AND hourly_scan_run_id = ?',
      [eventId, latest.id],
    );
    return rows.length > 0;
  }

  async upsertMissingOrgRepoEvent(scanContextId: string, missingName: string): Promise<string> {
    const found = await this.q('SELECT id FROM missing_org_repo_event WHERE scan_context_id = ?', [scanContextId]);
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO missing_org_repo_event (id, created_at, scan_context_id, missing_name) VALUES (?, ?, ?, ?)',
      [id, nowSql(), scanContextId, missingName],
    );
    return id;
  }

  async observeMissingRepo(eventId: string, hourlyScanRunId: string): Promise<void> {
    await this.exec(
      'INSERT IGNORE INTO missing_repo_observed (missing_org_repo_event_id, hourly_scan_run_id) VALUES (?, ?)',
      [eventId, hourlyScanRunId],
    );
  }

  async missingRepoPresent(eventId: string): Promise<boolean> {
    const latest = await this.latestHourlyScanRun();
    if (!latest) {
      return true;
    }
    const rows = await this.q(
      'SELECT hourly_scan_run_id FROM missing_repo_observed WHERE missing_org_repo_event_id = ? AND hourly_scan_run_id = ?',
      [eventId, latest.id],
    );
    return rows.length > 0;
  }

  async upsertMissingDepScanEvent(scanContextId: string): Promise<string> {
    const found = await this.q('SELECT id FROM missing_dep_scan_event WHERE scan_context_id = ?', [scanContextId]);
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO missing_dep_scan_event (id, created_at, scan_context_id) VALUES (?, ?, ?)',
      [id, nowSql(), scanContextId],
    );
    return id;
  }

  async upsertDependencyVulnEvent(
    scanContextId: string,
    packageIdentity: string,
    vulnKey: string,
  ): Promise<string> {
    const found = await this.q(
      'SELECT id FROM dependency_vuln_event WHERE scan_context_id = ? AND package_identity = ? AND vuln_key = ?',
      [scanContextId, packageIdentity, vulnKey],
    );
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO dependency_vuln_event (id, created_at, scan_context_id, package_identity, vuln_key) VALUES (?, ?, ?, ?, ?)',
      [id, nowSql(), scanContextId, packageIdentity, vulnKey],
    );
    return id;
  }

  async observeDepVuln(
    eventId: string,
    mergeIngestRunId: string,
    projectVersion: string,
    resolvedDepVersion: string,
  ): Promise<void> {
    await this.exec(
      `INSERT INTO dep_vuln_observed (dependency_vuln_event_id, merge_ingest_run_id, project_version, resolved_dep_version)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE project_version = VALUES(project_version), resolved_dep_version = VALUES(resolved_dep_version)`,
      [eventId, mergeIngestRunId, projectVersion, resolvedDepVersion],
    );
  }

  async depVulnIsPresent(eventId: string): Promise<boolean> {
    const ev = await this.q('SELECT scan_context_id FROM dependency_vuln_event WHERE id = ?', [eventId]);
    if (!ev[0]) {
      return false;
    }
    const latest = await this.latestMergeIngestRun(String(ev[0].scan_context_id));
    if (!latest) {
      return true;
    }
    const rows = await this.q(
      'SELECT merge_ingest_run_id FROM dep_vuln_observed WHERE dependency_vuln_event_id = ? AND merge_ingest_run_id = ?',
      [eventId, latest.id],
    );
    return rows.length > 0;
  }

  async upsertUpstreamMainlineEvent(
    scanContextId: string,
    upstreamId: string,
    commit: string,
    title: string,
  ): Promise<string> {
    const found = await this.q(
      'SELECT id FROM upstream_mainline_event WHERE scan_context_id = ? AND upstream_id = ? AND commit_sha = ?',
      [scanContextId, upstreamId, commit],
    );
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO upstream_mainline_event (id, created_at, scan_context_id, upstream_id, commit_sha, title) VALUES (?, ?, ?, ?, ?, ?)',
      [id, nowSql(), scanContextId, upstreamId, commit, title],
    );
    return id;
  }

  async upsertBipArrivedEvent(bipId: string): Promise<string> {
    const found = await this.q('SELECT id FROM bip_arrived_event WHERE bip_id = ?', [bipId]);
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec('INSERT INTO bip_arrived_event (id, created_at, bip_id) VALUES (?, ?, ?)', [
      id,
      nowSql(),
      bipId,
    ]);
    return id;
  }

  async upsertStaleUpstreamEvent(upstreamId: string): Promise<string> {
    const found = await this.q('SELECT id FROM stale_upstream_event WHERE upstream_id = ?', [upstreamId]);
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec('INSERT INTO stale_upstream_event (id, created_at, upstream_id) VALUES (?, ?, ?)', [
      id,
      nowSql(),
      upstreamId,
    ]);
    return id;
  }

  async upsertDistantFeedEvent(
    feedSourceId: string,
    sourceNativeId: string,
    title: string,
    summary: string,
  ): Promise<string> {
    const found = await this.q(
      'SELECT id FROM distant_feed_event WHERE feed_source_id = ? AND source_native_id = ?',
      [feedSourceId, sourceNativeId],
    );
    if (found[0]) {
      return String(found[0].id);
    }
    const id = randomUUID();
    await this.exec(
      'INSERT INTO distant_feed_event (id, created_at, feed_source_id, source_native_id, title, summary) VALUES (?, ?, ?, ?, ?, ?)',
      [id, nowSql(), feedSourceId, sourceNativeId, title, summary],
    );
    return id;
  }

  async upsertPolledFeedSource(id: string, name: string, ackCadence: string): Promise<void> {
    await this.exec(
      `INSERT INTO polled_feed_source (id, name, ack_cadence) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), ack_cadence = VALUES(ack_cadence)`,
      [id, name, ackCadence],
    );
  }

  async ackDistant(maintainerId: string, eventId: string, at: string): Promise<void> {
    const rows = await this.q('SELECT id FROM distant_feed_event WHERE id = ?', [eventId]);
    if (!rows[0]) {
      throw new RadarProblem(404, 'notFound', 'Distant event not found');
    }
    await this.exec(
      `INSERT INTO maintainer_acks_event (maintainer_id, distant_feed_event_id, acked_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE acked_at = VALUES(acked_at)`,
      [maintainerId, eventId, at.slice(0, 23).replace('T', ' ').replace('Z', '')],
    );
  }

  async isDistantAcked(eventId: string): Promise<boolean> {
    const rows = await this.q('SELECT distant_feed_event_id FROM maintainer_acks_event WHERE distant_feed_event_id = ?', [
      eventId,
    ]);
    return rows.length > 0;
  }

  async insertTask(title: string, eventId: string): Promise<TaskRow> {
    const row: TaskRow = { id: randomUUID(), title, createdAt: new Date().toISOString(), eventId };
    await this.exec('INSERT INTO task (id, title, created_at, event_id) VALUES (?, ?, ?, ?)', [
      row.id,
      title,
      nowSql(),
      eventId,
    ]);
    await this.exec('INSERT IGNORE INTO task_for_event (task_id, event_id) VALUES (?, ?)', [row.id, eventId]);
    return row;
  }

  async getTask(id: string): Promise<TaskRow | undefined> {
    const rows = await this.q('SELECT id, title, created_at, completed_at, event_id FROM task WHERE id = ?', [id]);
    return rows[0] ? this.taskFromRow(rows[0]) : undefined;
  }

  async acceptTask(maintainerId: string, taskId: string, at: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new RadarProblem(404, 'notFound', 'Task not found');
    }
    await this.exec(
      `INSERT INTO maintainer_takes_task (maintainer_id, task_id, accepted_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE accepted_at = VALUES(accepted_at)`,
      [maintainerId, taskId, at.slice(0, 23).replace('T', ' ').replace('Z', '')],
    );
  }

  async completeTask(maintainerId: string, taskId: string, at: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new RadarProblem(404, 'notFound', 'Task not found');
    }
    const stamp = at.slice(0, 23).replace('T', ' ').replace('Z', '');
    await this.exec('UPDATE task SET completed_at = ? WHERE id = ?', [stamp, taskId]);
    await this.exec(
      `INSERT INTO maintainer_takes_task (maintainer_id, task_id, accepted_at, completed_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
      [maintainerId, taskId, stamp, stamp],
    );
  }

  async openTaskForEvent(eventId: string): Promise<TaskRow | undefined> {
    const rows = await this.q(
      `SELECT t.id, t.title, t.created_at, t.completed_at, t.event_id FROM task t
       INNER JOIN task_for_event x ON x.task_id = t.id
       WHERE x.event_id = ? AND t.completed_at IS NULL LIMIT 1`,
      [eventId],
    );
    return rows[0] ? this.taskFromRow(rows[0]) : undefined;
  }

  async listTasks(): Promise<Array<{ id: string; title: string; complete: boolean; accepted: boolean; eventId?: string }>> {
    const rows = await this.q(
      `SELECT t.id, t.title, t.created_at, t.completed_at, t.event_id,
              EXISTS(
                SELECT 1 FROM maintainer_takes_task m
                WHERE m.task_id = t.id AND m.accepted_at IS NOT NULL
              ) AS accepted
       FROM task t`,
    );
    return rows.map((r) => {
      const t = this.taskFromRow(r);
      return {
        id: t.id,
        title: t.title,
        complete: Boolean(t.completedAt),
        accepted: Number(r.accepted) === 1,
        eventId: t.eventId,
      };
    });
  }

  async markTaskComplete(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task || task.completedAt) {
      return;
    }
    await this.exec('UPDATE task SET completed_at = ? WHERE id = ?', [nowSql(), taskId]);
  }

  async taskCompleteForEvent(eventId: string): Promise<boolean> {
    const rows = await this.q(
      `SELECT t.id FROM task t INNER JOIN task_for_event x ON x.task_id = t.id
       WHERE x.event_id = ? AND t.completed_at IS NOT NULL LIMIT 1`,
      [eventId],
    );
    return rows.length > 0;
  }

  async recordHumanAssessment(eventId: string, writeup: string): Promise<string> {
    await this.assertEventExists(eventId);
    const id = randomUUID();
    await this.exec('INSERT INTO human_assessment (id, writeup) VALUES (?, ?)', [id, writeup]);
    await this.exec('INSERT IGNORE INTO event_has_assessment (event_id, assessment_id) VALUES (?, ?)', [eventId, id]);
    return id;
  }

  async recordNoForkAssessment(eventId: string, writeup: string): Promise<string> {
    await this.assertEventExists(eventId);
    const id = randomUUID();
    await this.exec('INSERT INTO no_fork_assessment (id, writeup) VALUES (?, ?)', [id, writeup]);
    await this.exec('INSERT IGNORE INTO event_has_assessment (event_id, assessment_id) VALUES (?, ?)', [eventId, id]);
    return id;
  }

  async recordSoftForkAssessment(eventId: string, writeup: string): Promise<string> {
    await this.assertEventExists(eventId);
    const id = randomUUID();
    await this.exec('INSERT INTO soft_fork_assessment (id, writeup) VALUES (?, ?)', [id, writeup]);
    await this.exec('INSERT IGNORE INTO event_has_assessment (event_id, assessment_id) VALUES (?, ?)', [eventId, id]);
    await this.addEventBucket(eventId, 'ChainForkThreat');
    return id;
  }

  async recordHardForkAssessment(eventId: string, writeup: string): Promise<string> {
    await this.assertEventExists(eventId);
    const id = randomUUID();
    await this.exec('INSERT INTO hard_fork_assessment (id, writeup) VALUES (?, ?)', [id, writeup]);
    await this.exec('INSERT IGNORE INTO event_has_assessment (event_id, assessment_id) VALUES (?, ?)', [eventId, id]);
    await this.addEventBucket(eventId, 'ChainForkThreat');
    return id;
  }

  async addEventBucket(eventId: string, kind: string): Promise<void> {
    await this.exec('INSERT IGNORE INTO event_in_bucket (event_id, threat_kind_id) VALUES (?, ?)', [eventId, kind]);
  }

  async bucketsFor(eventId: string): Promise<string[]> {
    const rows = await this.q('SELECT threat_kind_id FROM event_in_bucket WHERE event_id = ?', [eventId]);
    return rows.map((r) => String(r.threat_kind_id));
  }

  async hasProducerAssessment(eventId: string): Promise<boolean> {
    const rows = await this.q(
      `SELECT a.assessment_id FROM event_has_assessment a
       INNER JOIN human_assessment h ON h.id = a.assessment_id
       WHERE a.event_id = ? LIMIT 1`,
      [eventId],
    );
    return rows.length > 0;
  }

  async hasForkAssessment(eventId: string): Promise<boolean> {
    const rows = await this.q(
      `SELECT a.assessment_id FROM event_has_assessment a
       WHERE a.event_id = ? AND (
         EXISTS (SELECT 1 FROM no_fork_assessment n WHERE n.id = a.assessment_id)
         OR EXISTS (SELECT 1 FROM soft_fork_assessment s WHERE s.id = a.assessment_id)
         OR EXISTS (SELECT 1 FROM hard_fork_assessment h WHERE h.id = a.assessment_id)
       ) LIMIT 1`,
      [eventId],
    );
    return rows.length > 0;
  }

  async getQuantumClock(): Promise<QuantumClockPublic | undefined> {
    const clocks = await this.q('SELECT id, summary FROM quantum_clock LIMIT 1');
    const c = clocks[0];
    if (!c) {
      return undefined;
    }
    const miles = await this.q(
      `SELECT m.id, m.at_label, m.label FROM quantum_milestone m
       INNER JOIN clock_has_milestone x ON x.quantum_milestone_id = m.id
       WHERE x.quantum_clock_id = ?`,
      [String(c.id)],
    );
    return {
      id: String(c.id),
      summary: String(c.summary),
      milestones: miles.map((m) => ({ id: String(m.id), at: String(m.at_label), label: String(m.label) })),
    };
  }

  async seedQuantumClock(clock: QuantumClockPublic): Promise<void> {
    await this.exec(
      `INSERT INTO quantum_clock (id, summary) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE summary = VALUES(summary)`,
      [clock.id, clock.summary],
    );
    for (const m of clock.milestones) {
      await this.exec(
        `INSERT INTO quantum_milestone (id, at_label, label) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE at_label = VALUES(at_label), label = VALUES(label)`,
        [m.id, m.at, m.label],
      );
      await this.exec(
        'INSERT IGNORE INTO clock_has_milestone (quantum_clock_id, quantum_milestone_id) VALUES (?, ?)',
        [clock.id, m.id],
      );
    }
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
    return (await this.q('SELECT id FROM dependency_vuln_event')).map((r) => String(r.id));
  }

  async listMissingScanContextEventIds(): Promise<string[]> {
    return (await this.q('SELECT id FROM missing_scan_context_event')).map((r) => String(r.id));
  }

  async listMissingOrgRepoEventIds(): Promise<string[]> {
    return (await this.q('SELECT id FROM missing_org_repo_event')).map((r) => String(r.id));
  }

  async listUpstreamMainlineEventIds(): Promise<string[]> {
    return (await this.q('SELECT id FROM upstream_mainline_event')).map((r) => String(r.id));
  }

  async listBipIds(): Promise<string[]> {
    return (await this.q('SELECT id FROM bip')).map((r) => String(r.id));
  }

  async listDistantEventIds(): Promise<string[]> {
    return (await this.q('SELECT id FROM distant_feed_event')).map((r) => String(r.id));
  }

  private bipFromRow(r: Row): BipRow {
    return {
      id: String(r.id),
      number: Number(r.number),
      title: String(r.title),
      summary: String(r.summary),
      ...(r.what_it_does ? { whatItDoes: String(r.what_it_does) } : {}),
      ...(r.how_it_hits_us ? { howItHitsUs: String(r.how_it_hits_us) } : {}),
      ...(r.honor_notes ? { honorNotes: String(r.honor_notes) } : {}),
      ...(r.ethos_notes ? { ethosNotes: String(r.ethos_notes) } : {}),
    };
  }

  private taskFromRow(r: Row): TaskRow {
    return {
      id: String(r.id),
      title: String(r.title),
      createdAt: toIso(String(r.created_at)),
      ...(r.completed_at ? { completedAt: toIso(String(r.completed_at)) } : {}),
      ...(r.event_id ? { eventId: String(r.event_id) } : {}),
    };
  }

  private async assertEventExists(eventId: string): Promise<void> {
    if (await this.toDto(eventId)) {
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

  private async allIds(): Promise<string[]> {
    const tables = [
      'missing_scan_context_event',
      'missing_org_repo_event',
      'missing_dep_scan_event',
      'dependency_vuln_event',
      'upstream_mainline_event',
      'bip_arrived_event',
      'stale_upstream_event',
      'distant_feed_event',
    ];
    const ids: string[] = [];
    for (const table of tables) {
      const rows = await this.q(`SELECT id FROM ${table}`);
      ids.push(...rows.map((r) => String(r.id)));
    }
    return ids;
  }

  private async allDtos(): Promise<PublicEventDto[]> {
    const out: PublicEventDto[] = [];
    for (const id of await this.allIds()) {
      const dto = await this.toDto(id);
      if (dto) {
        out.push(dto);
      }
    }
    return out;
  }

  private async toDto(id: string): Promise<PublicEventDto | undefined> {
    const buckets = await this.bucketsFor(id);
    const mc = await this.q(
      'SELECT id, created_at, github_owner_name FROM missing_scan_context_event WHERE id = ?',
      [id],
    );
    if (mc[0]) {
      return withEventDisplay({
        type: 'MissingScanContextEvent',
        id: String(mc[0].id),
        createdAt: toIso(String(mc[0].created_at)),
        githubOwnerName: String(mc[0].github_owner_name),
        present: await this.missingContextPresent(id),
        buckets,
      });
    }
    const mo = await this.q(
      'SELECT id, created_at, scan_context_id, missing_name FROM missing_org_repo_event WHERE id = ?',
      [id],
    );
    if (mo[0]) {
      return withEventDisplay({
        type: 'MissingOrgRepoEvent',
        id: String(mo[0].id),
        createdAt: toIso(String(mo[0].created_at)),
        scanContextId: String(mo[0].scan_context_id),
        missingName: String(mo[0].missing_name),
        present: await this.missingRepoPresent(id),
        buckets,
      });
    }
    const md = await this.q('SELECT id, created_at, scan_context_id FROM missing_dep_scan_event WHERE id = ?', [id]);
    if (md[0]) {
      return withEventDisplay({
        type: 'MissingDepScanEvent',
        id: String(md[0].id),
        createdAt: toIso(String(md[0].created_at)),
        scanContextId: String(md[0].scan_context_id),
        buckets,
      });
    }
    const dv = await this.q(
      'SELECT id, created_at, scan_context_id, package_identity, vuln_key FROM dependency_vuln_event WHERE id = ?',
      [id],
    );
    if (dv[0]) {
      return withEventDisplay({
        type: 'DependencyVulnEvent',
        id: String(dv[0].id),
        createdAt: toIso(String(dv[0].created_at)),
        scanContextId: String(dv[0].scan_context_id),
        packageIdentity: String(dv[0].package_identity),
        vulnKey: String(dv[0].vuln_key),
        present: await this.depVulnIsPresent(id),
        taskComplete: await this.taskCompleteForEvent(id),
        buckets,
      });
    }
    const um = await this.q(
      'SELECT id, created_at, scan_context_id, upstream_id, commit_sha, title FROM upstream_mainline_event WHERE id = ?',
      [id],
    );
    if (um[0]) {
      return withEventDisplay({
        type: 'UpstreamMainlineEvent',
        id: String(um[0].id),
        createdAt: toIso(String(um[0].created_at)),
        scanContextId: String(um[0].scan_context_id),
        upstreamId: String(um[0].upstream_id),
        commit: String(um[0].commit_sha),
        title: String(um[0].title),
        buckets,
      });
    }
    const ba = await this.q('SELECT id, created_at, bip_id FROM bip_arrived_event WHERE id = ?', [id]);
    if (ba[0]) {
      const bip = await this.getBip(String(ba[0].bip_id));
      return withEventDisplay({
        type: 'BipArrivedEvent',
        id: String(ba[0].id),
        createdAt: toIso(String(ba[0].created_at)),
        bipId: String(ba[0].bip_id),
        bipNumber: bip?.number,
        bipTitle: bip?.title,
        bipSummary: bip?.summary,
        buckets,
      });
    }
    const st = await this.q('SELECT id, created_at, upstream_id FROM stale_upstream_event WHERE id = ?', [id]);
    if (st[0]) {
      return withEventDisplay({
        type: 'StaleUpstreamEvent',
        id: String(st[0].id),
        createdAt: toIso(String(st[0].created_at)),
        upstreamId: String(st[0].upstream_id),
        buckets,
      });
    }
    const di = await this.q(
      'SELECT id, created_at, feed_source_id, source_native_id, title, summary FROM distant_feed_event WHERE id = ?',
      [id],
    );
    if (di[0]) {
      return withEventDisplay({
        type: 'DistantFeedEvent',
        id: String(di[0].id),
        createdAt: toIso(String(di[0].created_at)),
        feedSourceId: String(di[0].feed_source_id),
        sourceNativeId: String(di[0].source_native_id),
        title: String(di[0].title),
        summary: String(di[0].summary),
        acked: await this.isDistantAcked(id),
        buckets,
      });
    }
    return undefined;
  }
}
