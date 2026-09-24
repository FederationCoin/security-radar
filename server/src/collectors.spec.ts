import { describe, expect, it } from 'vitest';
import { MemoryIntelStore } from './infra/memory/intel-store';
import { CollectOrgRepos } from './collectors/collect-org-repos';
import { ReconcileScanContexts } from './collectors/reconcile-scan-contexts';
import { IngestDepReports, parseArtifacts, vulnsFromNpmAudit, vulnsFromOsvScanner } from './collectors/ingest-dep-reports';
import { CollectUpstreamTips } from './collectors/collect-upstream-tips';
import { CollectBips } from './collectors/collect-bips';
import { CollectDistantFeeds } from './collectors/collect-distant-feeds';
import { OpenTasksForGaps } from './collectors/open-tasks-for-gaps';
import { CollectorTick } from './collectors/tick';
import { UnconfiguredPort } from './infra/optional-port';
import type { GitHubPort, NostrPort, OsvPort, RssPort, XPort } from './ports/chain-view';

const github: GitHubPort = {
  async listOrgRepos() {
    return [
      { name: 'cpu-miner', defaultBranch: 'federationcoin', private: false },
      { name: 'federation-pool', defaultBranch: 'federationcoin', private: false },
    ];
  },
  async listMergedDefaultBranchArtifacts(repo: string) {
    if (repo === 'empty') {
      return [];
    }
    return [
      {
        repo,
        runId: '99',
        kind: 'osv',
        json: {
          results: [{ packages: [{ package: { name: 'leftpad', version: '1.0.0' }, vulnerabilities: [{ id: 'GHSA-1' }] }] }],
        },
      },
    ];
  },
  async listDependabotAlerts() {
    return [{ repo: 'cpu-miner', packageIdentity: 'leftpad', vulnKey: 'GHSA-1' }];
  },
  async listUpstreamCommits() {
    return [{ sha: 'deadbeef', message: 'tweak nBits', committedAt: new Date().toISOString() }];
  },
  async listBips() {
    return [{ number: 9, title: 'Version bits', summary: 'soft fork bits' }];
  },
};

describe('collectors', () => {
  it('parses osv-scanner and npm audit JSON', () => {
    expect(vulnsFromOsvScanner(null)).toEqual([]);
    expect(vulnsFromOsvScanner({ results: 'nope' })).toEqual([]);
    expect(
      vulnsFromOsvScanner({
        results: [{ packages: [{ package: { name: 'x', version: '1' }, vulnerabilities: [{ id: 'CVE-1' }] }] }],
      }),
    ).toEqual([{ packageIdentity: 'x', version: '1', vulnKey: 'CVE-1' }]);
    expect(vulnsFromOsvScanner({ results: [{ packages: 'nope' }] })).toEqual([]);
    expect(vulnsFromOsvScanner({ results: [{ packages: [null] }] })).toEqual([]);
    expect(vulnsFromOsvScanner({ results: [{ packages: [{ package: { name: 'x' }, vulnerabilities: 'nope' }] }] })).toEqual([]);
    expect(vulnsFromNpmAudit(null)).toEqual([]);
    expect(vulnsFromNpmAudit({ vulnerabilities: { y: { via: 'nope' } } })).toEqual([]);
    expect(vulnsFromNpmAudit({ vulnerabilities: { y: { via: [{}] } } })).toEqual([]);
    expect(parseArtifacts([{ repo: 'r', runId: '1', kind: 'npmAudit', json: { vulnerabilities: {} } }])).toEqual([]);
  });

  it('skips unconfigured ports and still runs reconcile', async () => {
    const intel = new MemoryIntelStore();
    const skip = new CollectOrgRepos(intel, new UnconfiguredPort('GitHubPort'));
    await skip.run('h1');
    const ingestSkip = new IngestDepReports(intel, new UnconfiguredPort('GitHubPort'), new UnconfiguredPort('OsvPort'));
    await ingestSkip.run();
    const upSkip = new CollectUpstreamTips(intel, new UnconfiguredPort('GitHubPort'));
    await upSkip.run('h1');
    const bipSkip = new CollectBips(intel, new UnconfiguredPort('GitHubPort'));
    await bipSkip.run();
    const distantSkip = new CollectDistantFeeds(
      intel,
      new UnconfiguredPort('XPort'),
      new UnconfiguredPort('NostrPort'),
      new UnconfiguredPort('RssPort'),
      { xHandles: [], nostrNpubs: [], nostrRelays: [], rssUrls: [], orgRepos: [] },
    );
    await distantSkip.run();
    const hourly = await intel.insertHourlyScanRun();
    await new CollectOrgRepos(intel, github).run(hourly.id);
    const rec = new ReconcileScanContexts(intel);
    await rec.run(hourly.id);
    const ctx = await intel.insertScanContext('orphan');
    const gone = await intel.upsertGitHubRepository('FederationCoin', 'gone-repo');
    await intel.trackRepo(ctx.id, gone.id);
    await rec.run(hourly.id);
    const contexts = await intel.listScanContexts();
    expect(contexts.some((c) => c.name === 'cpu-miner')).toBe(true);
    expect(await intel.listMissingScanContextEventIds()).toEqual([]);
    const leftover = await intel.insertTask('Create ScanContext for FederationCoin/cpu-miner', 'evt');
    const untracked = await intel.insertTask('Create ScanContext for FederationCoin/not-tracked', 'evt');
    const scan = await intel.insertTask('Missing radar-deps artifact for cpu-miner', 'evt');
    await rec.run(hourly.id);
    const tasks = await intel.listTasks();
    expect(tasks.find((t) => t.id === leftover.id)?.complete).toBe(true);
    expect(tasks.find((t) => t.id === untracked.id)?.complete).toBe(false);
    expect(tasks.find((t) => t.id === scan.id)?.complete).toBe(false);
    await intel.markTaskComplete(leftover.id);
    await intel.markTaskComplete('missing');
  });

  it('ingests artifacts, upstream, bips, distant feeds, and gap tasks', async () => {
    const intel = new MemoryIntelStore();
    const ctx = await intel.insertScanContext('mill');
    const repo = await intel.upsertGitHubRepository('FederationCoin', 'cpu-miner');
    await intel.trackRepo(ctx.id, repo.id);
    const up = await intel.upsertUpstream('knots', 'bitcoinknots/bitcoin');
    await intel.followsUpstream(ctx.id, up.id);
    const osv: OsvPort = { query: async () => [{ id: 'GHSA-1', summary: 'x' }] };
    await new IngestDepReports(intel, github, osv).run();
    expect((await intel.listDependencyVulnEventIds()).length).toBeGreaterThan(0);
    const oldGh: GitHubPort = {
      ...github,
      listUpstreamCommits: async () => [
        { sha: 'old', message: 'ancient', committedAt: '2010-01-01T00:00:00.000Z' },
      ],
    };
    await intel.followsUpstream(ctx.id, 'does-not-exist');
    const hourly = await intel.insertHourlyScanRun();
    await new CollectUpstreamTips(intel, oldGh).run(hourly.id);
    await new CollectBips(intel, github).run();
    const x: XPort = { pollHandle: async () => [{ id: 't1', text: 'note', createdAt: new Date().toISOString() }] };
    const nostr: NostrPort = { pollNpub: async () => [{ id: 'n1', text: 'note', createdAt: new Date().toISOString() }] };
    const rss: RssPort = { pollUrl: async () => [{ id: 'r1', title: 'oss', summary: 'sec' }] };
    await new CollectDistantFeeds(intel, x, nostr, rss, {
      xHandles: ['Calle'],
      nostrNpubs: ['npub1abc'],
      nostrRelays: ['wss://relay.example'],
      rssUrls: ['https://example.test/feed'],
      orgRepos: [],
    }).run();
    const gaps = new OpenTasksForGaps(intel);
    await gaps.run();
    const tasks = await intel.listTasks();
    expect(tasks.length).toBeGreaterThan(0);
    const publicPage = await intel.listPublicEvents();
    expect(publicPage.items.some((e) => e.type === 'BipArrivedEvent')).toBe(true);
    expect(publicPage.items.some((e) => e.type === 'UpstreamMainlineEvent')).toBe(true);
    const assessed = publicPage.items.find((e) => e.type === 'UpstreamMainlineEvent');
    if (assessed) {
      await intel.recordNoForkAssessment(assessed.id, 'no fork');
    }
    await gaps.run();
    const emptyGh: GitHubPort = {
      ...github,
      listMergedDefaultBranchArtifacts: async () => [],
    };
    await new IngestDepReports(intel, emptyGh, new UnconfiguredPort('OsvPort')).run();
    const tick = new CollectorTick(
      intel,
      new CollectOrgRepos(intel, github),
      new ReconcileScanContexts(intel),
      new IngestDepReports(intel, github, new UnconfiguredPort('OsvPort')),
      new CollectUpstreamTips(intel, github),
      new CollectBips(intel, github),
      new CollectDistantFeeds(intel, new UnconfiguredPort('XPort'), new UnconfiguredPort('NostrPort'), new UnconfiguredPort('RssPort'), {
        xHandles: [],
        nostrNpubs: [],
        nostrRelays: [],
        rssUrls: [],
        orgRepos: [],
      }),
      gaps,
    );
    await tick.runHourly();
  });

  it('does not open a BIP review task after that BIP has a review', async () => {
    const intel = new MemoryIntelStore();
    await new CollectBips(intel, github).run();
    const bip = (await intel.listBips())[0];
    await intel.reviewBip('maintainer', bip.id, { understanding: 'version bits', applicability: 'we use them' }, new Date().toISOString());
    const partial = await intel.upsertBip({ number: 11, title: 'M-of-N', summary: 'multisig' });
    await intel.reviewBip('maintainer', partial.id, { understanding: '   ', applicability: 'we already have it' }, new Date().toISOString());
    const other = await intel.upsertBip({ number: 16, title: 'Pay to script hash', summary: 'p2sh' });
    await intel.reviewBip('maintainer', other.id, { understanding: 'hash the script', applicability: '   ' }, new Date().toISOString());
    await new OpenTasksForGaps(intel).run();
    const titles = (await intel.listTasks()).map((t) => t.title);
    expect(titles).toContain('Review BIP 11');
    expect(titles).toContain('Review BIP 16');
    expect(titles.some((t) => t.startsWith('Review BIP 9'))).toBe(false);
  });

  it('opens a review task again after complete while the BIP is still unreviewed', async () => {
    const intel = new MemoryIntelStore();
    await new CollectBips(intel, github).run();
    const gaps = new OpenTasksForGaps(intel);
    await gaps.run();
    const first = (await intel.listTasks()).filter((t) => t.title.startsWith('Review BIP'));
    expect(first).toHaveLength(1);
    expect(first[0].accepted).toBe(false);
    await intel.acceptTask('maintainer', first[0].id, new Date().toISOString());
    expect((await intel.listTasks()).find((t) => t.id === first[0].id)?.accepted).toBe(true);
    await intel.completeTask('maintainer', first[0].id, new Date().toISOString());
    await gaps.run();
    expect((await intel.listTasks()).filter((t) => t.title.startsWith('Review BIP'))).toHaveLength(2);
  });
});
