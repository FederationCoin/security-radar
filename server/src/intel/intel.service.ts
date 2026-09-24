import { Inject, Injectable } from '@nestjs/common';
import {
  TokenChainView,
  TokenEnvelopeLog,
  TokenIntelStore,
  TokenPublicReadLimiter,
  TokenSettings,
} from '../domain/constants';
import type { ChainId } from '../domain/constants';
import { assertEnvelope } from '../domain/envelope';
import { sha256Hex } from '../domain/jcs';
import {
  RadarProblem,
  type AcceptTask,
  type AckDistantFeed,
  type CommandKind,
  type CompleteTask,
  type CreateScanContext,
  type RecordHardForkAssessment,
  type RecordHumanAssessment,
  type RecordNoForkAssessment,
  type RecordSoftForkAssessment,
  type ReviewBip,
  type SigningEnvelope,
} from '../domain/types';
import type { ChainView, EnvelopeLog, PublicReadRateLimiter } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import type { ApiSettings } from '../ports/secret-store';
import type { AssessmentPort } from '../ports/chain-view';

@Injectable()
export class IntelService {
  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenChainView) private readonly chain: ChainView,
    @Inject(TokenPublicReadLimiter) private readonly reads: PublicReadRateLimiter,
    @Inject(TokenEnvelopeLog) private readonly envelopes: EnvelopeLog,
    @Inject(TokenSettings) private readonly settings: ApiSettings,
  ) {}

  async limitPublic(ip: string): Promise<void> {
    const hit = await this.reads.hitPublicRead(ip);
    if (!hit.allowed) {
      throw new RadarProblem(429, 'rateLimited', 'Too many requests', String(hit.retryAfterSeconds));
    }
  }

  async listEvents(ip: string, cursor?: string) {
    await this.limitPublic(ip);
    return this.intel.listPublicEvents(cursor);
  }

  async getEvent(ip: string, id: string) {
    await this.limitPublic(ip);
    const ev = await this.intel.getEvent(id);
    if (!ev) {
      throw new RadarProblem(404, 'notFound', 'Event not found');
    }
    return ev;
  }

  async listBips(ip: string) {
    await this.limitPublic(ip);
    return { items: await this.intel.listBips() };
  }

  async getClock(ip: string) {
    await this.limitPublic(ip);
    const stored = await this.intel.getQuantumClock();
    if (stored) {
      return stored;
    }
    if (this.settings.quantumClock) {
      await this.intel.seedQuantumClock(this.settings.quantumClock);
      return this.settings.quantumClock;
    }
    return undefined;
  }

  async listTasks(ip: string) {
    await this.limitPublic(ip);
    return { items: await this.intel.listTasks() };
  }

  async listUnackedDistant(chain: ChainId, env: SigningEnvelope) {
    await this.assertSigned(chain, env, 'listUnackedDistant', { commandKind: 'listUnackedDistant' });
    return { items: await this.intel.listUnackedDistant() };
  }

  async acceptTask(chain: ChainId, env: SigningEnvelope, body: AcceptTask) {
    const m = await this.assertSigned(chain, env, 'acceptTask', body);
    await this.intel.acceptTask(m.id, body.taskId, new Date().toISOString());
    return { ok: true };
  }

  async completeTask(chain: ChainId, env: SigningEnvelope, body: CompleteTask) {
    const m = await this.assertSigned(chain, env, 'completeTask', body);
    await this.intel.completeTask(m.id, body.taskId, new Date().toISOString());
    return { ok: true };
  }

  async reviewBip(chain: ChainId, env: SigningEnvelope, body: ReviewBip) {
    const m = await this.assertSigned(chain, env, 'reviewBip', body);
    const bip = await this.intel.getBip(body.bipId);
    if (!bip) {
      throw new RadarProblem(404, 'notFound', 'BIP not found');
    }
    const understanding = body.understanding?.trim() ?? '';
    const applicability = body.applicability?.trim() ?? '';
    if (!understanding || !applicability) {
      throw new RadarProblem(400, 'unknownField', 'understanding and applicability are required');
    }
    await this.intel.reviewBip(
      m.id,
      body.bipId,
      {
        understanding,
        applicability,
        honor: body.honor,
        implement: body.implement,
      },
      new Date().toISOString(),
    );
    return { ok: true };
  }

  async ackDistant(chain: ChainId, env: SigningEnvelope, body: AckDistantFeed) {
    const m = await this.assertSigned(chain, env, 'ackDistantFeed', body);
    await this.intel.ackDistant(m.id, body.eventId, new Date().toISOString());
    return { ok: true };
  }

  async createScanContext(chain: ChainId, env: SigningEnvelope, body: CreateScanContext) {
    await this.assertSigned(chain, env, 'createScanContext', body);
    const ctx = await this.intel.insertScanContext(body.name);
    const repo = await this.intel.upsertGitHubRepository(body.githubOwner, body.githubName);
    await this.intel.trackRepo(ctx.id, repo.id);
    return ctx;
  }

  async recordHuman(chain: ChainId, env: SigningEnvelope, body: RecordHumanAssessment, port: AssessmentPort) {
    await this.assertSigned(chain, env, 'recordHumanAssessment', body);
    await port.recordHumanAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordNoFork(chain: ChainId, env: SigningEnvelope, body: RecordNoForkAssessment) {
    await this.assertSigned(chain, env, 'recordNoForkAssessment', body);
    await this.intel.recordNoForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordSoftFork(chain: ChainId, env: SigningEnvelope, body: RecordSoftForkAssessment) {
    await this.assertSigned(chain, env, 'recordSoftForkAssessment', body);
    await this.intel.recordSoftForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordHardFork(chain: ChainId, env: SigningEnvelope, body: RecordHardForkAssessment) {
    await this.assertSigned(chain, env, 'recordHardForkAssessment', body);
    await this.intel.recordHardForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  private async assertSigned(chain: ChainId, env: SigningEnvelope, kind: CommandKind, command: unknown) {
    assertEnvelope(env, chain, kind, command);
    const tip = await this.chain.getTip(chain);
    if (env.signingBlockHeight !== tip.height || env.signingBlockHash !== tip.hash) {
      throw new RadarProblem(400, 'tipMismatch', 'Envelope tip does not match chain tip');
    }
    if (!this.settings.maintainerAllowlist.includes(env.wallet)) {
      throw new RadarProblem(401, 'notMaintainer', 'Signer is not on the Maintainer allowlist');
    }
    const dup = sha256Hex(env.commandKind + env.payloadHash + env.signature);
    if (await this.envelopes.seen(dup)) {
      throw new RadarProblem(400, 'duplicateEnvelope', 'Envelope was already used');
    }
    await this.envelopes.remember(dup);
    return this.intel.ensureMaintainer(env.wallet);
  }
}
