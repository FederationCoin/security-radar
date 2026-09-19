import type { ChainId } from '../domain/constants';
import type { QuantumClockPublic } from '../domain/types';

export type MariaSettings = {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
};

export type RpcChainSettings = {
  hosts: string[];
  username: string;
  password: string;
};

export type GitHubAppSettings = {
  appId: string;
  installationId: string;
  privateKey: string;
};

export type GitHubPatSettings = {
  token: string;
};

export type ApiSettings = {
  maria?: MariaSettings;
  chainRpc: Partial<Record<ChainId, RpcChainSettings>>;
  corsOrigins: string[];
  trustedProxyHops: number;
  maintainerAllowlist: string[];
  quantumClock?: QuantumClockPublic;
};

export type CollectorSettings = {
  maria?: MariaSettings;
  githubApp?: GitHubAppSettings;
  githubPat?: GitHubPatSettings;
  xBearer?: string;
  xHandles: string[];
  nvdApiKey?: string;
  nostrNpubs: string[];
  nostrRelays: string[];
  rssUrls: string[];
  orgRepos: string[];
};

export interface SecretStore<T> {
  load(): Promise<T>;
}
