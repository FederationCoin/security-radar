import { readFile } from 'node:fs/promises';
import type { ApiSettings, CollectorSettings, SecretStore } from '../../ports/secret-store';

export class EnvFileSecretStore<T> implements SecretStore<T> {
  constructor(private readonly path: string) {}

  async load(): Promise<T> {
    return JSON.parse(await readFile(this.path, 'utf8')) as T;
  }
}

export class StaticSecretStore<T> implements SecretStore<T> {
  constructor(private readonly settings: T) {}
  async load(): Promise<T> {
    return this.settings;
  }
}

export function defaultApiSettings(): ApiSettings {
  return {
    chainRpc: {},
    corsOrigins: ['https://radar.federationcoin.org', 'http://localhost:4200'],
    trustedProxyHops: 1,
    maintainerAllowlist: [],
    sessionMaxBlockDepth: 48,
  };
}

export function defaultCollectorSettings(): CollectorSettings {
  return {
    xHandles: [],
    nostrNpubs: [],
    nostrRelays: [],
    rssUrls: [],
    orgRepos: [],
  };
}
