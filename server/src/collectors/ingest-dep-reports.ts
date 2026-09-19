import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenGitHub, TokenIntelStore, TokenOsv } from '../domain/constants';
import type { GitHubPort, MergeArtifact, OsvPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import { isConfigured, UnconfiguredPort } from '../infra/optional-port';

export function vulnsFromOsvScanner(json: unknown): Array<{ packageIdentity: string; version: string; vulnKey: string }> {
  const out: Array<{ packageIdentity: string; version: string; vulnKey: string }> = [];
  if (!json || typeof json !== 'object') {
    return out;
  }
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return out;
  }
  for (const result of results) {
    const packages = result && typeof result === 'object' ? (result as { packages?: unknown }).packages : undefined;
    if (!Array.isArray(packages)) {
      continue;
    }
    for (const pkg of packages) {
      if (!pkg || typeof pkg !== 'object') {
        continue;
      }
      const p = (pkg as { package?: { name?: string; version?: string } }).package;
      const vulns = (pkg as { vulnerabilities?: Array<{ id?: string }> }).vulnerabilities;
      const name = p?.name;
      const version = p?.version ?? '';
      if (!name || !Array.isArray(vulns)) {
        continue;
      }
      for (const v of vulns) {
        if (v?.id) {
          out.push({ packageIdentity: name, version, vulnKey: v.id });
        }
      }
    }
  }
  return out;
}

export function vulnsFromNpmAudit(json: unknown): Array<{ packageIdentity: string; version: string; vulnKey: string }> {
  const out: Array<{ packageIdentity: string; version: string; vulnKey: string }> = [];
  if (!json || typeof json !== 'object') {
    return out;
  }
  const vulns = (json as { vulnerabilities?: Record<string, { via?: unknown[] }> }).vulnerabilities;
  if (!vulns || typeof vulns !== 'object') {
    return out;
  }
  for (const [name, body] of Object.entries(vulns)) {
    const via = body?.via;
    if (!Array.isArray(via)) {
      continue;
    }
    for (const item of via) {
      if (item && typeof item === 'object' && 'source' in item) {
        const source = (item as { source?: string | number }).source;
        if (source !== undefined) {
          out.push({ packageIdentity: name, version: '', vulnKey: String(source) });
        }
      }
    }
  }
  return out;
}

@Injectable()
export class IngestDepReports {
  private readonly log = new Logger(IngestDepReports.name);

  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenGitHub) private readonly github: GitHubPort | UnconfiguredPort,
    @Inject(TokenOsv) private readonly osv: OsvPort | UnconfiguredPort,
  ) {}

  async run(): Promise<void> {
    if (!isConfigured(this.github)) {
      this.log.warn('skip IngestDepReports: GitHubPort unconfigured');
      return;
    }
    const contexts = await this.intel.listScanContexts();
    for (const ctx of contexts) {
      const repo = await this.intel.getTrackedRepo(ctx.id);
      if (!repo) {
        continue;
      }
      const artifacts = await this.github.listMergedDefaultBranchArtifacts(repo.name);
      if (artifacts.length === 0) {
        const eventId = await this.intel.upsertMissingDepScanEvent(ctx.id);
        if (!(await this.intel.openTaskForEvent(eventId))) {
          await this.intel.insertTask(`Missing radar-deps artifact for ${ctx.name}`, eventId);
        }
        continue;
      }
      const latest = artifacts[0];
      const run = await this.intel.insertMergeIngestRun(ctx.id, latest.runId);
      const found = parseArtifacts(artifacts);
      const seen = new Set<string>();
      for (const v of found) {
        const eventId = await this.intel.upsertDependencyVulnEvent(ctx.id, v.packageIdentity, v.vulnKey);
        await this.intel.observeDepVuln(eventId, run.id, ctx.name, v.version);
        seen.add(eventId);
        if (isConfigured(this.osv)) {
          await this.osv.query(v.packageIdentity, v.version);
        }
      }
      const alerts = await this.github.listDependabotAlerts(repo.name);
      for (const a of alerts) {
        const eventId = await this.intel.upsertDependencyVulnEvent(ctx.id, a.packageIdentity, a.vulnKey);
        await this.intel.observeDepVuln(eventId, run.id, ctx.name, '');
        seen.add(eventId);
      }
    }
  }
}

export function parseArtifacts(artifacts: MergeArtifact[]): Array<{ packageIdentity: string; version: string; vulnKey: string }> {
  const out: Array<{ packageIdentity: string; version: string; vulnKey: string }> = [];
  for (const a of artifacts) {
    if (a.kind === 'osv') {
      out.push(...vulnsFromOsvScanner(a.json));
    } else {
      out.push(...vulnsFromNpmAudit(a.json));
    }
  }
  return out;
}
