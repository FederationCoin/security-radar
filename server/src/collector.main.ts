import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CollectorModule } from './collector.module';
import { CollectorTick } from './collectors/tick';

async function bootstrap(): Promise<void> {
  const log = new Logger('collector');
  const app = await NestFactory.createApplicationContext(CollectorModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    await app.get(CollectorTick).runHourly();
  } catch (e) {
    log.error(e instanceof Error ? e.message : 'collector tick failed');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
