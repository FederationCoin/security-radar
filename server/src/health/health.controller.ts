import { Controller, Get, Inject } from '@nestjs/common';
import { PACKAGE_VERSION, TokenIntelStore } from '../domain/constants';
import { RadarProblem } from '../domain/types';
import type { IntelStore } from '../ports/intel-store';

@Controller()
export class HealthController {
  constructor(@Inject(TokenIntelStore) private readonly intel: IntelStore) {}

  @Get('healthz')
  healthz() {
    return { status: 'ok', version: PACKAGE_VERSION };
  }

  @Get('readyz')
  async readyz() {
    try {
      await this.intel.ping();
    } catch {
      throw new RadarProblem(503, 'notReady', 'Store is not ready');
    }
    return { status: 'ready' };
  }
}
