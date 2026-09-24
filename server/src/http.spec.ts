import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TokenChainView,
  TokenEnvelopeLog,
  TokenIntelStore,
  TokenPublicReadLimiter,
  TokenSettings,
  PublicReadLimitPerMinute,
} from './domain/constants';
import { ProblemFilter } from './http/problem.filter';
import { CommandsController, IntelController } from './http/intel.controller';
import { DocsController } from './http/docs.controller';
import { HealthController } from './health/health.controller';
import { IntelService } from './intel/intel.service';
import { HumanAssessmentAdapter } from './intel/human-assessment';
import { MemoryIntelStore } from './infra/memory/intel-store';
import { MemoryRateAdapters } from './infra/memory/rate';
import { MemoryChainView } from './infra/memory/chain-view';
import { bearer, signEnvelope, testKey } from './test-support';
import { bech32 } from 'bech32';

async function appWith(allow: string[] = [], opts: { clock?: boolean } = {}) {
  const intel = new MemoryIntelStore();
  const rates = new MemoryRateAdapters();
  const chain = new MemoryChainView();
  const settings = {
    chainRpc: {},
    corsOrigins: ['https://radar.federationcoin.org'],
    trustedProxyHops: 1,
    maintainerAllowlist: allow,
    ...(opts.clock === false
      ? {}
      : {
          quantumClock: {
            id: 'clock-1',
            summary: 'PQ wallet timeline',
            milestones: [{ id: 'm1', at: '2035', label: 'CRQC watch' }],
          },
        }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [IntelController, CommandsController, DocsController, HealthController],
    providers: [
      IntelService,
      HumanAssessmentAdapter,
      { provide: TokenIntelStore, useValue: intel },
      { provide: TokenPublicReadLimiter, useValue: rates },
      { provide: TokenEnvelopeLog, useValue: rates },
      { provide: TokenChainView, useValue: chain },
      { provide: TokenSettings, useValue: settings },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemFilter());
  await app.init();
  return { app, intel, chain, rates };
}

describe('http radar', () => {
  let app: INestApplication;
  let intel: MemoryIntelStore;
  let chain: MemoryChainView;
  let wallet: string;
  let priv: Uint8Array;

  beforeAll(async () => {
    const k = testKey();
    wallet = k.wallet;
    priv = k.priv;
    const built = await appWith([wallet]);
    app = built.app;
    intel = built.intel;
    chain = built.chain;
  });

  afterAll(async () => {
    await app.close();
  });

  function signed(commandKind: Parameters<typeof signEnvelope>[0]['commandKind'], command: unknown) {
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind,
      command,
      signingBlockHash: chain.state.hash,
      signingBlockHeight: chain.state.height,
    });
    return { env, header: bearer(env) };
  }

  it('serves health, docs, and openapi 0.3.0', async () => {
    await request(app.getHttpServer()).get('/v1/healthz').expect(200);
    await request(app.getHttpServer()).get('/v1/readyz').expect(200);
    await request(app.getHttpServer()).get('/v1/docs').expect(200);
    const spec = await request(app.getHttpServer()).get('/v1/openapi.json').expect(200);
    expect(spec.body.info.version).toBe('0.3.0');
  });

  it('requires chain header and rejects dummy MAIN', async () => {
    await request(app.getHttpServer()).get('/v1/intel/events').expect(400);
    await request(app.getHttpServer())
      .get('/v1/intel/events')
      .set('X-FederationCoin-Chain', 'main')
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/intel/events')
      .set('X-FederationCoin-Chain', 'regtest')
      .expect(400);
  });

  it('hides unacked distant from public GET and 404s the id', async () => {
    const id = await intel.upsertDistantFeedEvent('x', 'post-1', 'Calle', 'zero-day note');
    const list = await request(app.getHttpServer())
      .get('/v1/intel/events')
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(204);
    expect(list.body).toEqual({});
    await request(app.getHttpServer())
      .get(`/v1/intel/events/${id}`)
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(404);
    const { header } = signed('listUnackedDistant', { commandKind: 'listUnackedDistant' });
    const hidden = await request(app.getHttpServer())
      .get('/v1/intel/distant-unacked')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', header)
      .expect(200);
    expect(hidden.body.items.some((e: { id: string }) => e.id === id)).toBe(true);
  });

  it('acks a distant feed then shows it on public GET', async () => {
    const id = await intel.upsertDistantFeedEvent('x', 'post-2', 'Rob', 'acked later');
    const body = { eventId: id };
    const { header } = signed('ackDistantFeed', body);
    await request(app.getHttpServer())
      .post('/v1/feeds/ack')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', header)
      .send(body)
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/v1/intel/events')
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(200);
    expect(list.body.items.find((e: { id: string }) => e.id === id)?.acked).toBe(true);
  });

  it('DepVulnObserved present then absent; complete does not clear the flag', async () => {
    const ctx = await intel.insertScanContext('node');
    const eventId = await intel.upsertDependencyVulnEvent(ctx.id, 'openssl', 'CVE-1');
    const run1 = await intel.insertMergeIngestRun(ctx.id, '1');
    await intel.observeDepVuln(eventId, run1.id, '29.5', '1.0.0');
    expect(await intel.depVulnIsPresent(eventId)).toBe(true);
    await intel.insertMergeIngestRun(ctx.id, '2');
    expect(await intel.depVulnIsPresent(eventId)).toBe(false);
    const run3 = await intel.insertMergeIngestRun(ctx.id, '3');
    await intel.observeDepVuln(eventId, run3.id, '29.5', '1.0.1');
    expect(await intel.depVulnIsPresent(eventId)).toBe(true);
    const task = await intel.insertTask('patch openssl', eventId);
    const complete = { taskId: task.id };
    const { header } = signed('completeTask', complete);
    await request(app.getHttpServer())
      .post('/v1/tasks/complete')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', header)
      .send(complete)
      .expect(200);
    expect(await intel.depVulnIsPresent(eventId)).toBe(true);
    const got = await request(app.getHttpServer())
      .get(`/v1/intel/events/${eventId}`)
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(200);
    expect(got.body.present).toBe(true);
    expect(got.body.taskComplete).toBe(true);
    const missingBip = { bipId: 'no-such', understanding: 'a', applicability: 'b' };
    const br = signed('reviewBip', missingBip);
    await request(app.getHttpServer())
      .post('/v1/bips/review')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', br.header)
      .send(missingBip)
      .expect(404);
  });

  it('creates scan context, reviews BIP, assessments, and rejects taproot', async () => {
    const create = { name: 'mill', githubOwner: 'FederationCoin', githubName: 'cpu-miner' };
    const { header } = signed('createScanContext', create);
    const created = await request(app.getHttpServer())
      .post('/v1/scan-contexts')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', header)
      .send(create)
      .expect(201);
    expect(created.body.name).toBe('mill');

    const bip = await intel.upsertBip({ number: 341, title: 'Taproot', summary: 'witness v1' });
    const blank = { bipId: bip.id, understanding: '  ', applicability: 'we do not implement' };
    const blankSigned = signed('reviewBip', blank);
    const blankRes = await request(app.getHttpServer())
      .post('/v1/bips/review')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', blankSigned.header)
      .send(blank);
    expect(blankRes.status).toBe(400);
    const blankApp = { bipId: bip.id, understanding: 'Schnorr', applicability: ' ' };
    const blankAppSigned = signed('reviewBip', blankApp);
    const blankAppRes = await request(app.getHttpServer())
      .post('/v1/bips/review')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', blankAppSigned.header)
      .send(blankApp);
    expect(blankAppRes.status).toBe(400);

    const review = {
      bipId: bip.id,
      understanding: 'Schnorr signatures and MAST.',
      applicability: 'We do not implement Taproot on FederationCoin.',
      honor: true,
      implement: false,
    };
    const r = signed('reviewBip', review);
    await request(app.getHttpServer())
      .post('/v1/bips/review')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', r.header)
      .send(review)
      .expect(200);
    const bips = await request(app.getHttpServer())
      .get('/v1/intel/bips')
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(200);
    const row = bips.body.items.find((b: { id: string }) => b.id === bip.id);
    expect(row.whatItDoes).toBe('Schnorr signatures and MAST.');
    expect(row.howItHitsUs).toBe('We do not implement Taproot on FederationCoin.');
    expect(row.honorNotes).toBe('We honor this BIP.');

    const um = await intel.upsertUpstreamMainlineEvent(created.body.id, 'up-1', 'abc', 'consensus tweak');
    const human = { eventId: um, writeup: 'we keep our nBits' };
    const h = signed('recordHumanAssessment', human);
    await request(app.getHttpServer())
      .post('/v1/assessments/human')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', h.header)
      .send(human)
      .expect(200);
    const nf = signed('recordNoForkAssessment', human);
    await request(app.getHttpServer())
      .post('/v1/assessments/no-fork')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', nf.header)
      .send(human)
      .expect(200);
    const sf = signed('recordSoftForkAssessment', human);
    await request(app.getHttpServer())
      .post('/v1/assessments/soft-fork')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', sf.header)
      .send(human)
      .expect(200);
    const hf = signed('recordHardForkAssessment', human);
    await request(app.getHttpServer())
      .post('/v1/assessments/hard-fork')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', hf.header)
      .send(human)
      .expect(200);

    const tap = bech32.encode('tgfcn', [1, ...bech32.toWords(Buffer.alloc(32, 9))]);
    const env = signEnvelope({
      priv,
      wallet: tap,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command: { taskId: 'nope' },
      signingBlockHash: chain.state.hash,
      signingBlockHeight: chain.state.height,
    });
    await request(app.getHttpServer())
      .post('/v1/tasks/accept')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', bearer(env))
      .send({ taskId: 'nope' })
      .expect(401);
  });

  it('lists bips, clock, tasks; 401 without bearer; tip mismatch', async () => {
    await request(app.getHttpServer()).get('/v1/intel/bips').set('X-FederationCoin-Chain', 'testnet').expect(200);
    await request(app.getHttpServer())
      .get('/v1/intel/quantum-clock')
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(200);
    await request(app.getHttpServer()).get('/v1/intel/tasks').set('X-FederationCoin-Chain', 'testnet').expect(200);
    await request(app.getHttpServer())
      .get('/v1/intel/distant-unacked')
      .set('X-FederationCoin-Chain', 'testnet')
      .expect(401);
    const body = { taskId: 'missing' };
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'acceptTask',
      command: body,
      signingBlockHash: 'cd'.repeat(32),
      signingBlockHeight: 99,
    });
    const res = await request(app.getHttpServer())
      .post('/v1/tasks/accept')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', bearer(env))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('rejects unknown maintainer and duplicate envelopes', async () => {
    const other = testKey();
    const body = { name: 'lib', githubOwner: 'FederationCoin', githubName: 'drongo' };
    const env = signEnvelope({
      priv: other.priv,
      wallet: other.wallet,
      chain: 'testnet',
      commandKind: 'createScanContext',
      command: body,
      signingBlockHash: chain.state.hash,
      signingBlockHeight: chain.state.height,
    });
    await request(app.getHttpServer())
      .post('/v1/scan-contexts')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', bearer(env))
      .send(body)
      .expect(401);
    const task = await intel.insertTask('do thing', 'evt');
    const accept = { taskId: task.id };
    const first = signed('acceptTask', accept);
    await request(app.getHttpServer())
      .post('/v1/tasks/accept')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', first.header)
      .send(accept)
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/tasks/accept')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('Authorization', first.header)
      .send(accept)
      .expect(400);
  });

  it('returns 204 when the URI is right and there is no representation', async () => {
    const empty = await appWith([wallet], { clock: false });
    const chainHdr = { 'X-FederationCoin-Chain': 'testnet' };
    await request(empty.app.getHttpServer()).get('/v1/intel/events').set(chainHdr).expect(204);
    await request(empty.app.getHttpServer()).get('/v1/intel/bips').set(chainHdr).expect(204);
    await request(empty.app.getHttpServer()).get('/v1/intel/tasks').set(chainHdr).expect(204);
    await request(empty.app.getHttpServer()).get('/v1/intel/quantum-clock').set(chainHdr).expect(204);
    await request(empty.app.getHttpServer()).get('/v1/intel/events/missing').set(chainHdr).expect(404);
    const env = signEnvelope({
      priv,
      wallet,
      chain: 'testnet',
      commandKind: 'listUnackedDistant',
      command: { commandKind: 'listUnackedDistant' },
      signingBlockHash: empty.chain.state.hash,
      signingBlockHeight: empty.chain.state.height,
    });
    await request(empty.app.getHttpServer())
      .get('/v1/intel/distant-unacked')
      .set(chainHdr)
      .set('Authorization', bearer(env))
      .expect(204);
    const bip = await empty.intel.upsertBip({ number: 1, title: 'P2SH', summary: 'p2sh' });
    const eventId = await empty.intel.upsertBipArrivedEvent(bip.id);
    await request(empty.app.getHttpServer()).get('/v1/intel/bips').set(chainHdr).expect(200);
    const events = await request(empty.app.getHttpServer()).get('/v1/intel/events').set(chainHdr).expect(200);
    const arrived = events.body.items.find((e: { id: string }) => e.id === eventId);
    expect(arrived.headline).toBe('BIP 1 — P2SH');
    expect(arrived.blurb).toBe('p2sh');
    expect(arrived.sourceUrl).toContain('bip-0001');
    const one = await request(empty.app.getHttpServer())
      .get(`/v1/intel/events/${eventId}`)
      .set(chainHdr)
      .expect(200);
    expect(one.body.headline).toBe('BIP 1 — P2SH');
    await request(empty.app.getHttpServer()).get('/v1/intel/events/missing').set(chainHdr).expect(404);
    await empty.intel.seedQuantumClock({
      id: 'c',
      summary: 'pq',
      milestones: [{ id: 'm', at: '2035', label: 'watch' }],
    });
    await request(empty.app.getHttpServer()).get('/v1/intel/quantum-clock').set(chainHdr).expect(200);
    await empty.intel.insertTask('review', 'evt');
    await request(empty.app.getHttpServer()).get('/v1/intel/tasks').set(chainHdr).expect(200);
    await empty.app.close();
  });

  it('readyz is 503 when the store ping fails', async () => {
    const down = {
      ping: async () => {
        throw new Error('down');
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: TokenIntelStore, useValue: down }],
    }).compile();
    const downApp = moduleRef.createNestApplication();
    downApp.setGlobalPrefix('v1');
    downApp.useGlobalFilters(new ProblemFilter());
    await downApp.init();
    await request(downApp.getHttpServer()).get('/v1/readyz').expect(503);
    await downApp.close();
  });

  it('sets Retry-After on 429', async () => {
    const limited = new MemoryRateAdapters();
    for (let i = 0; i < PublicReadLimitPerMinute; i++) {
      await limited.hitPublicRead('9.9.9.9');
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [IntelController],
      providers: [
        IntelService,
        HumanAssessmentAdapter,
        { provide: TokenIntelStore, useValue: intel },
        { provide: TokenPublicReadLimiter, useValue: limited },
        { provide: TokenEnvelopeLog, useValue: limited },
        { provide: TokenChainView, useValue: chain },
        {
          provide: TokenSettings,
          useValue: {
            chainRpc: {},
            corsOrigins: ['https://radar.federationcoin.org'],
            trustedProxyHops: 1,
            maintainerAllowlist: [wallet],
          },
        },
      ],
    }).compile();
    const limitedApp = moduleRef.createNestApplication();
    limitedApp.setGlobalPrefix('v1');
    limitedApp.useGlobalFilters(new ProblemFilter());
    await limitedApp.init();
    const res = await request(limitedApp.getHttpServer())
      .get('/v1/intel/events')
      .set('X-FederationCoin-Chain', 'testnet')
      .set('X-Forwarded-For', '9.9.9.9');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeTruthy();
    await limitedApp.close();
  });
});
