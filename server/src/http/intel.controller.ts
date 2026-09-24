import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IntelService } from '../intel/intel.service';
import { HumanAssessmentAdapter } from '../intel/human-assessment';
import { ChainHeaderGuard } from './chain.guard';
import { SigningEnvelopeGuard } from './envelope.guard';
import { Chain, ClientIp, Envelope } from './params';
import { sendCollection, sendRepresentation } from './no-content';
import type { ChainId } from '../domain/constants';
import type {
  AcceptTask,
  AckDistantFeed,
  CompleteTask,
  CreateScanContext,
  RecordHardForkAssessment,
  RecordHumanAssessment,
  RecordNoForkAssessment,
  RecordSoftForkAssessment,
  ReviewBip,
  SigningEnvelope,
} from '../domain/types';

@Controller()
export class IntelController {
  constructor(@Inject(IntelService) private readonly intel: IntelService) {}

  @Get('intel/events')
  @UseGuards(ChainHeaderGuard)
  async listEvents(@ClientIp() ip: string, @Res({ passthrough: true }) res: Response, @Query('cursor') cursor?: string) {
    return sendCollection(res, await this.intel.listEvents(ip, cursor));
  }

  @Get('intel/events/:id')
  @UseGuards(ChainHeaderGuard)
  getEvent(@ClientIp() ip: string, @Param('id') id: string) {
    return this.intel.getEvent(ip, id);
  }

  @Get('intel/bips')
  @UseGuards(ChainHeaderGuard)
  async listBips(@ClientIp() ip: string, @Res({ passthrough: true }) res: Response) {
    return sendCollection(res, await this.intel.listBips(ip));
  }

  @Get('intel/quantum-clock')
  @UseGuards(ChainHeaderGuard)
  async getClock(@ClientIp() ip: string, @Res({ passthrough: true }) res: Response) {
    return sendRepresentation(res, await this.intel.getClock(ip));
  }

  @Get('intel/tasks')
  @UseGuards(ChainHeaderGuard)
  async listTasks(@ClientIp() ip: string, @Res({ passthrough: true }) res: Response) {
    return sendCollection(res, await this.intel.listTasks(ip));
  }

  @Get('intel/distant-unacked')
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  async listUnacked(@Chain() chain: ChainId, @Envelope() env: SigningEnvelope, @Res({ passthrough: true }) res: Response) {
    return sendCollection(res, await this.intel.listUnackedDistant(chain, env));
  }
}

@Controller()
export class CommandsController {
  constructor(
    @Inject(IntelService) private readonly intel: IntelService,
    @Inject(HumanAssessmentAdapter) private readonly human: HumanAssessmentAdapter,
  ) {}

  @Post('tasks/accept')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  accept(@Chain() chain: ChainId, @Envelope() env: SigningEnvelope, @Body() body: AcceptTask) {
    return this.intel.acceptTask(chain, env, body);
  }

  @Post('tasks/complete')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  complete(@Chain() chain: ChainId, @Envelope() env: SigningEnvelope, @Body() body: CompleteTask) {
    return this.intel.completeTask(chain, env, body);
  }

  @Post('bips/review')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  review(@Chain() chain: ChainId, @Envelope() env: SigningEnvelope, @Body() body: ReviewBip) {
    return this.intel.reviewBip(chain, env, body);
  }

  @Post('feeds/ack')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  ack(@Chain() chain: ChainId, @Envelope() env: SigningEnvelope, @Body() body: AckDistantFeed) {
    return this.intel.ackDistant(chain, env, body);
  }

  @Post('scan-contexts')
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  async create(
    @Chain() chain: ChainId,
    @Envelope() env: SigningEnvelope,
    @Body() body: CreateScanContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.intel.createScanContext(chain, env, body);
    res.status(201);
    return out;
  }

  @Post('assessments/human')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  humanWrite(
    @Chain() chain: ChainId,
    @Envelope() env: SigningEnvelope,
    @Body() body: RecordHumanAssessment,
  ) {
    return this.intel.recordHuman(chain, env, body, this.human);
  }

  @Post('assessments/no-fork')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  noFork(
    @Chain() chain: ChainId,
    @Envelope() env: SigningEnvelope,
    @Body() body: RecordNoForkAssessment,
  ) {
    return this.intel.recordNoFork(chain, env, body);
  }

  @Post('assessments/soft-fork')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  softFork(
    @Chain() chain: ChainId,
    @Envelope() env: SigningEnvelope,
    @Body() body: RecordSoftForkAssessment,
  ) {
    return this.intel.recordSoftFork(chain, env, body);
  }

  @Post('assessments/hard-fork')
  @HttpCode(200)
  @UseGuards(ChainHeaderGuard, SigningEnvelopeGuard)
  hardFork(
    @Chain() chain: ChainId,
    @Envelope() env: SigningEnvelope,
    @Body() body: RecordHardForkAssessment,
  ) {
    return this.intel.recordHardFork(chain, env, body);
  }
}
