import { Inject, Injectable } from '@nestjs/common';
import {
  TokenChainView,
  TokenIntelStore,
  TokenPublicReadLimiter,
  TokenSettings,
} from '../domain/constants';
import type { ChainId } from '../domain/constants';
import { assertEnvelope } from '../domain/envelope';
import { sessionMessage, sessionPayloadHash } from '../domain/jcs';
import {
  RadarProblem,
  type AcceptTask,
  type AckDistantFeed,
  type CompleteTask,
  type CreateScanContext,
  type RecordHardForkAssessment,
  type RecordHumanAssessment,
  type RecordNoForkAssessment,
  type RecordSoftForkAssessment,
  type ReviewBip,
  type SigningEnvelope,
} from '../domain/types';
import type { ChainView, PublicReadRateLimiter } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';
import type { ApiSettings } from '../ports/secret-store';
import type { AssessmentPort } from '../ports/chain-view';

@Injectable()
export class IntelService {
  constructor(
    @Inject(TokenIntelStore) private readonly intel: IntelStore,
    @Inject(TokenChainView) private readonly chain: ChainView,
    @Inject(TokenPublicReadLimiter) private readonly reads: PublicReadRateLimiter,
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

  async signContext(ip: string, chain: ChainId) {
    await this.limitPublic(ip);
    const tip = await this.chain.getTip(chain);
    const issuedAt = new Date().toISOString();
    const fields = {
      chain,
      signingBlockHeight: tip.height,
      signingBlockHash: tip.hash,
      issuedAt,
    };
    return {
      signingBlockHeight: tip.height,
      signingBlockHash: tip.hash,
      issuedAt,
      message: sessionMessage(fields),
      payloadHash: sessionPayloadHash(fields),
    };
  }

  async listUnackedDistant(chain: ChainId, env: SigningEnvelope) {
    await this.assertSigned(chain, env);
    return { items: await this.intel.listUnackedDistant() };
  }

  async acceptTask(chain: ChainId, env: SigningEnvelope, body: AcceptTask) {
    const m = await this.assertSigned(chain, env);
    await this.intel.acceptTask(m.id, body.taskId, new Date().toISOString());
    return { ok: true };
  }

  async completeTask(chain: ChainId, env: SigningEnvelope, body: CompleteTask) {
    const m = await this.assertSigned(chain, env);
    await this.intel.completeTask(m.id, body.taskId, new Date().toISOString());
    return { ok: true };
  }

  async reviewBip(chain: ChainId, env: SigningEnvelope, body: ReviewBip) {
    const m = await this.assertSigned(chain, env);
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
    const m = await this.assertSigned(chain, env);
    await this.intel.ackDistant(m.id, body.eventId, new Date().toISOString());
    return { ok: true };
  }

  async createScanContext(chain: ChainId, env: SigningEnvelope, body: CreateScanContext) {
    await this.assertSigned(chain, env);
    const ctx = await this.intel.insertScanContext(body.name);
    const repo = await this.intel.upsertGitHubRepository(body.githubOwner, body.githubName);
    await this.intel.trackRepo(ctx.id, repo.id);
    return ctx;
  }

  async recordHuman(chain: ChainId, env: SigningEnvelope, body: RecordHumanAssessment, port: AssessmentPort) {
    await this.assertSigned(chain, env);
    await port.recordHumanAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordNoFork(chain: ChainId, env: SigningEnvelope, body: RecordNoForkAssessment) {
    await this.assertSigned(chain, env);
    await this.intel.recordNoForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordSoftFork(chain: ChainId, env: SigningEnvelope, body: RecordSoftForkAssessment) {
    await this.assertSigned(chain, env);
    await this.intel.recordSoftForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  async recordHardFork(chain: ChainId, env: SigningEnvelope, body: RecordHardForkAssessment) {
    await this.assertSigned(chain, env);
    await this.intel.recordHardForkAssessment(body.eventId, body.writeup);
    return { ok: true };
  }

  private async assertSigned(chain: ChainId, env: SigningEnvelope) {
    assertEnvelope(env, chain);
    const now = Date.now();
    const issued = Date.parse(env.issuedAt);
    const skewMs = 5 * 60 * 1000;
    const sessionMs = 30 * 60 * 1000;
    if (issued > now + skewMs) {
      throw new RadarProblem(400, 'tipMismatch', 'Signed time is ahead of the server clock');
    }
    if (now > issued + sessionMs) {
      throw new RadarProblem(400, 'tipMismatch', 'Maintainer session has expired');
    }
    const tip = await this.chain.getTip(chain);
    const depth = this.settings.sessionMaxBlockDepth ?? 48;
    if (env.signingBlockHeight > tip.height || tip.height - env.signingBlockHeight > depth) {
      throw new RadarProblem(400, 'tipMismatch', 'Signed block is outside the session depth');
    }
    const header = await this.chain.headerHashAt(chain, env.signingBlockHeight);
    if (!header || header !== env.signingBlockHash) {
      throw new RadarProblem(400, 'tipMismatch', 'Signed block hash is not on the active chain');
    }
    if (!this.settings.maintainerAllowlist.includes(env.wallet)) {
      throw new RadarProblem(401, 'notMaintainer', 'Signer is not on the Maintainer allowlist');
    }
    return this.intel.ensureMaintainer(env.wallet);
  }
}
