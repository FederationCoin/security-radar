import { Global, Logger, Module } from '@nestjs/common';
import {
  TokenChainView,
  TokenCollectorSettings,
  TokenEnvelopeLog,
  TokenGitHub,
  TokenIntelStore,
  TokenNostr,
  TokenOsv,
  TokenPublicReadLimiter,
  TokenRss,
  TokenSecretStore,
  TokenSettings,
  TokenX,
} from '../domain/constants';
import type { ApiSettings, CollectorSettings, SecretStore } from '../ports/secret-store';
import { MemoryChainView } from './memory/chain-view';
import { MemoryIntelStore } from './memory/intel-store';
import { MemoryRateAdapters } from './memory/rate';
import { AwsSecretsManagerSecretStore } from './secrets/aws-sm';
import { defaultApiSettings, defaultCollectorSettings, EnvFileSecretStore, StaticSecretStore } from './secrets/env-file';
import { RpcChainView } from './rpc/chain-view';
import { MysqlIntelStore } from './mysql/intel-store';
import { UnconfiguredPort } from './optional-port';
import { HttpGitHubPort } from './http/github';
import { HttpOsvPort } from './http/osv';
import { HttpNostrPort, HttpRssPort, HttpXPort } from './http/feeds';

export function apiSecretStoreFromEnv(): SecretStore<ApiSettings> {
  if (process.env.RADAR_SETTINGS_FILE) {
    return new EnvFileSecretStore<ApiSettings>(process.env.RADAR_SETTINGS_FILE);
  }
  if (process.env.RADAR_SECRET_ARN || process.env.RADAR_SECRET_NAME) {
    return new AwsSecretsManagerSecretStore<ApiSettings>(
      process.env.RADAR_SECRET_ARN ?? process.env.RADAR_SECRET_NAME!,
    );
  }
  return new StaticSecretStore(defaultApiSettings());
}

export function collectorSecretStoreFromEnv(): SecretStore<CollectorSettings> {
  if (process.env.RADAR_COLLECTOR_SETTINGS_FILE) {
    return new EnvFileSecretStore<CollectorSettings>(process.env.RADAR_COLLECTOR_SETTINGS_FILE);
  }
  if (process.env.RADAR_COLLECTOR_SECRET_ARN || process.env.RADAR_COLLECTOR_SECRET_NAME) {
    return new AwsSecretsManagerSecretStore<CollectorSettings>(
      process.env.RADAR_COLLECTOR_SECRET_ARN ?? process.env.RADAR_COLLECTOR_SECRET_NAME!,
    );
  }
  return new StaticSecretStore(defaultCollectorSettings());
}

@Global()
@Module({
  providers: [
    {
      provide: TokenSecretStore,
      useFactory: apiSecretStoreFromEnv,
    },
    {
      provide: TokenSettings,
      useFactory: async (store: SecretStore<ApiSettings>): Promise<ApiSettings> => store.load(),
      inject: [TokenSecretStore],
    },
    {
      provide: TokenCollectorSettings,
      useFactory: async (): Promise<CollectorSettings> => collectorSecretStoreFromEnv().load(),
    },
    {
      provide: TokenIntelStore,
      useFactory: async (settings: ApiSettings, collector: CollectorSettings) => {
        const maria = settings.maria ?? collector.maria;
        if (maria) {
          const store = new MysqlIntelStore(maria);
          await store.migrate();
          return store;
        }
        return new MemoryIntelStore();
      },
      inject: [TokenSettings, TokenCollectorSettings],
    },
    {
      provide: 'RateBundle',
      useFactory: () => new MemoryRateAdapters(),
    },
    { provide: TokenPublicReadLimiter, useExisting: 'RateBundle' },
    { provide: TokenEnvelopeLog, useExisting: 'RateBundle' },
    {
      provide: TokenChainView,
      useFactory: (settings: ApiSettings) => {
        if (settings.chainRpc.testnet?.hosts?.length) {
          return new RpcChainView(settings.chainRpc);
        }
        return new MemoryChainView();
      },
      inject: [TokenSettings],
    },
    {
      provide: TokenGitHub,
      useFactory: (s: CollectorSettings) =>
        s.githubPat?.token || s.githubApp ? new HttpGitHubPort(s) : new UnconfiguredPort('GitHubPort'),
      inject: [TokenCollectorSettings],
    },
    {
      provide: TokenX,
      useFactory: (s: CollectorSettings) => (s.xBearer ? new HttpXPort(s.xBearer) : new UnconfiguredPort('XPort')),
      inject: [TokenCollectorSettings],
    },
    {
      provide: TokenNostr,
      useFactory: (s: CollectorSettings) =>
        s.nostrNpubs.length ? new HttpNostrPort(s.nostrRelays) : new UnconfiguredPort('NostrPort'),
      inject: [TokenCollectorSettings],
    },
    {
      provide: TokenRss,
      useFactory: (s: CollectorSettings) =>
        s.rssUrls.length ? new HttpRssPort() : new UnconfiguredPort('RssPort'),
      inject: [TokenCollectorSettings],
    },
    { provide: TokenOsv, useFactory: () => new HttpOsvPort() },
    { provide: Logger, useFactory: () => new Logger('radar') },
  ],
  exports: [
    TokenIntelStore,
    TokenPublicReadLimiter,
    TokenEnvelopeLog,
    TokenChainView,
    TokenSecretStore,
    TokenSettings,
    TokenCollectorSettings,
    TokenGitHub,
    TokenX,
    TokenNostr,
    TokenRss,
    TokenOsv,
  ],
})
export class RadarInfraModule {}
