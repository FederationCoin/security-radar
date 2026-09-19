import { Module } from '@nestjs/common';
import { IntelService } from './intel.service';
import { DocsController } from '../http/docs.controller';
import { CommandsController, IntelController } from '../http/intel.controller';
import { HumanAssessmentAdapter } from './human-assessment';

@Module({
  controllers: [DocsController, IntelController, CommandsController],
  providers: [IntelService, HumanAssessmentAdapter],
  exports: [IntelService, HumanAssessmentAdapter],
})
export class IntelModule {}
