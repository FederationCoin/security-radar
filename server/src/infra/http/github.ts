import { createSign } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import type { BipSource, DependabotAlert, GitHubPort, MergeArtifact, OrgRepo, UpstreamCommit } from '../../ports/chain-view';
import type { CollectorSettings } from '../../ports/secret-store';

function unzipJsonFiles(buf: Buffer): Array<{ name: string; json: unknown }> {
  const out: Array<{ name: string; json: unknown }> = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    let raw: Buffer;
    if (method === 0) {
      raw = Buffer.from(data);
    } else if (method === 8) {
      raw = inflateRawSync(data);
    } else {
      offset = dataStart + compSize;
      continue;
    }
    const base = name.split('/').pop() ?? name;
    if (base.endsWith('.json')) {
      try {
        out.push({ name: base, json: JSON.parse(raw.toString('utf8')) as unknown });
      } catch {
        /* skip malformed */
      }
    }
    offset = dataStart + compSize;
  }
  return out;
}

function appJwt(appId: string, pem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })).toString('base64url');
  const data = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  return `${data}.${sign.sign(pem, 'base64url')}`;
}

export class HttpGitHubPort implements GitHubPort {
  private installationToken?: { value: string; exp: number };

  constructor(private readonly settings: CollectorSettings) {}

  private async bearer(): Promise<string> {
    if (this.settings.githubPat?.token) {
      return this.settings.githubPat.token;
    }
    const app = this.settings.githubApp;
    if (!app) {
      throw new Error('GitHub token missing');
    }
    const now = Date.now();
    if (this.installationToken && this.installationToken.exp > now + 30_000) {
      return this.installationToken.value;
    }
    const jwt = appJwt(app.appId, app.privateKey);
    const res = await fetch(`https://api.github.com/app/installations/${app.installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'federationcoin-radar',
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub ${res.status}`);
    }
    const body = (await res.json()) as { token: string; expires_at: string };
    this.installationToken = { value: body.token, exp: Date.parse(body.expires_at) };
    return body.token;
  }

  private async gh(path: string): Promise<unknown> {
    const t = await this.bearer();
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        authorization: `Bearer ${t}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'federationcoin-radar',
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub ${res.status}`);
    }
    return res.json();
  }

  async listOrgRepos(): Promise<OrgRepo[]> {
    const raw = (await this.gh('/orgs/FederationCoin/repos?per_page=100')) as Array<{
      name: string;
      default_branch: string;
      private: boolean;
    }>;
    return raw.map((r) => ({ name: r.name, defaultBranch: r.default_branch, private: r.private }));
  }

  async listMergedDefaultBranchArtifacts(repo: string): Promise<MergeArtifact[]> {
    const meta = (await this.gh(`/repos/FederationCoin/${repo}`)) as { default_branch?: string };
    const defaultBranch = meta.default_branch ?? 'federationcoin';
    const raw = (await this.gh(`/repos/FederationCoin/${repo}/actions/artifacts?per_page=30`)) as {
      artifacts?: Array<{
        id: number;
        name: string;
        created_at?: string;
        workflow_run?: { id: number; head_branch?: string; event?: string };
      }>;
    };
    const wanted = (raw.artifacts ?? []).filter(
      (a) =>
        a.name === 'radar-deps' &&
        a.workflow_run?.head_branch === defaultBranch &&
        a.workflow_run?.event !== 'pull_request',
    );
    const latest = wanted[0];
    if (!latest) {
      return [];
    }
    const t = await this.bearer();
    const zipRes = await fetch(`https://api.github.com/repos/FederationCoin/${repo}/actions/artifacts/${latest.id}/zip`, {
      headers: {
        authorization: `Bearer ${t}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'federationcoin-radar',
      },
    });
    if (!zipRes.ok) {
      return [];
    }
    const buf = Buffer.from(await zipRes.arrayBuffer());
    const files = unzipJsonFiles(buf);
    if (files.length === 0) {
      return [];
    }
    return files.map((f) => ({
      repo,
      runId: String(latest.workflow_run?.id ?? latest.id),
      kind: f.name.includes('npm') ? ('npmAudit' as const) : ('osv' as const),
      json: f.json,
    }));
  }

  async listDependabotAlerts(repo: string): Promise<DependabotAlert[]> {
    try {
      const raw = (await this.gh(`/repos/FederationCoin/${repo}/dependabot/alerts?state=open`)) as Array<{
        number: number;
        dependency?: { package?: { name?: string } };
        security_advisory?: { ghsa_id?: string };
      }>;
      return raw.map((a) => ({
        repo,
        packageIdentity: a.dependency?.package?.name ?? 'unknown',
        vulnKey: a.security_advisory?.ghsa_id ?? String(a.number),
      }));
    } catch {
      return [];
    }
  }

  async listUpstreamCommits(ownerRepo: string): Promise<UpstreamCommit[]> {
    const raw = (await this.gh(`/repos/${ownerRepo}/commits?per_page=10`)) as Array<{
      sha: string;
      commit?: { message?: string; committer?: { date?: string } };
    }>;
    return raw.map((c) => ({
      sha: c.sha,
      message: c.commit?.message ?? '',
      committedAt: c.commit?.committer?.date ?? new Date(0).toISOString(),
    }));
  }

  async listBips(): Promise<BipSource[]> {
    const raw = (await this.gh('/repos/bitcoin/bips/git/trees/master?recursive=1')) as {
      tree?: Array<{ path?: string; type?: string }>;
    };
    const out: BipSource[] = [];
    for (const node of raw.tree ?? []) {
      if (node.type !== 'blob' || !node.path) {
        continue;
      }
      const m = /^bip-(\d+)\.(mediawiki|md)$/i.exec(node.path.split('/').pop() ?? '');
      if (!m) {
        continue;
      }
      const number = Number(m[1]);
      out.push({
        number,
        title: `BIP ${number}`,
        summary: node.path,
      });
    }
    return out;
  }
}
