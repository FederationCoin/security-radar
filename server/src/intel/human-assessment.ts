import { Inject, Injectable } from '@nestjs/common';
import { TokenIntelStore } from '../domain/constants';
import { RadarProblem } from '../domain/types';
import type { AssessmentPort } from '../ports/chain-view';
import type { IntelStore } from '../ports/intel-store';

@Injectable()
export class HumanAssessmentAdapter implements AssessmentPort {
  constructor(@Inject(TokenIntelStore) private readonly intel: IntelStore) {}

  async recordHumanAssessment(eventId: string, writeup: string): Promise<void> {
    await this.intel.recordHumanAssessment(eventId, writeup);
  }

  async recordBedrockAssessment(_eventId: string, _writeup: string): Promise<void> {
    throw new RadarProblem(501, 'notImplemented', 'Bedrock assessment is spec-only');
  }

  async recordCursorAssessment(_eventId: string, _writeup: string): Promise<void> {
    throw new RadarProblem(501, 'notImplemented', 'Cursor assessment is spec-only');
  }
}
