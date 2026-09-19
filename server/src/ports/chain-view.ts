import type { ChainId } from '../domain/constants';

export type ChainTip = { height: number; hash: string };

export interface ChainView {
  getTip(chain: ChainId): Promise<ChainTip>;
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export interface PublicReadRateLimiter {
  hitPublicRead(ip: string): Promise<RateLimitResult>;
}

export interface EnvelopeLog {
  seen(hashHex: string): Promise<boolean>;
  remember(hashHex: string): Promise<void>;
}

export type OrgRepo = { name: string; defaultBranch: string; private: boolean };
export type MergeArtifact = { repo: string; runId: string; kind: 'osv' | 'npmAudit'; json: unknown };
export type DependabotAlert = { repo: string; packageIdentity: string; vulnKey: string };
export type UpstreamCommit = { sha: string; message: string; committedAt: string };
export type BipSource = { number: number; title: string; summary: string };

export interface GitHubPort {
  listOrgRepos(): Promise<OrgRepo[]>;
  listMergedDefaultBranchArtifacts(repo: string): Promise<MergeArtifact[]>;
  listDependabotAlerts(repo: string): Promise<DependabotAlert[]>;
  listUpstreamCommits(ownerRepo: string): Promise<UpstreamCommit[]>;
  listBips(): Promise<BipSource[]>;
}

export interface XPort {
  pollHandle(handle: string): Promise<Array<{ id: string; text: string; createdAt: string }>>;
}

export interface NostrPort {
  pollNpub(npub: string): Promise<Array<{ id: string; text: string; createdAt: string }>>;
}

export interface RssPort {
  pollUrl(url: string): Promise<Array<{ id: string; title: string; summary: string }>>;
}

export interface OsvPort {
  query(packageIdentity: string, version: string): Promise<Array<{ id: string; summary: string }>>;
}

export interface AssessmentPort {
  recordHumanAssessment(eventId: string, writeup: string): Promise<void>;
  recordBedrockAssessment(eventId: string, writeup: string): Promise<void>;
  recordCursorAssessment(eventId: string, writeup: string): Promise<void>;
}
