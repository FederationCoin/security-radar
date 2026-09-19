import { Module } from '@nestjs/common';
import { IntelModule } from './intel/intel.module';
import { HealthModule } from './health/health.module';
import { RadarInfraModule } from './infra/radar-infra.module';

@Module({
  imports: [RadarInfraModule, IntelModule, HealthModule],
})
export class AppModule {}
