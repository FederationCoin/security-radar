export const PACKAGE_VERSION = '0.1.0';

/** Sparrow Standard (Electrum) and node signmessage. */
export const BitcoinSignedMessageMagic = 'Bitcoin Signed Message:\n';

/** Optional FederationCoin prefix. Verify tries Bitcoin first, then this. */
export const RadarSignedMessageMagic = 'FederationCoin Signed Message:\n';

export const SignedMessageMagics = [BitcoinSignedMessageMagic, RadarSignedMessageMagic] as const;

export const EnvelopeBodyCapBytes = 8192;
export const CommandBodyCapBytes = 8192;
export const FindPageSize = 20;
export const PublicReadLimitPerMinute = 60;

export const LiveTenants = ['testnet'] as const;
export type ChainId = 'testnet' | 'main';

export const HrpByChain: Record<ChainId, string> = {
  testnet: 'tgfcn',
  main: 'gfcn',
};

export const FederationCoinOrgRepos = [
  'FederationCoin',
  'cpu-miner',
  'federation-sparrow',
  'mempool',
  'pool-registry',
  'security-radar',
  'drongo',
  'lark',
  'tern',
  'hummingbird',
  'toucan',
  'bokmakierie',
] as const;

export const TokenSettings = 'RadarSettings';
export const TokenCollectorSettings = 'CollectorSettings';
export const TokenSecretStore = 'SecretStore';
export const TokenCollectorSecretStore = 'CollectorSecretStore';
export const TokenIntelStore = 'IntelStore';
export const TokenChainView = 'ChainView';
export const TokenPublicReadLimiter = 'PublicReadRateLimiter';
export const TokenEnvelopeLog = 'EnvelopeLog';
export const TokenGitHub = 'GitHubPort';
export const TokenX = 'XPort';
export const TokenNostr = 'NostrPort';
export const TokenRss = 'RssPort';
export const TokenOsv = 'OsvPort';
export const TokenAssessment = 'AssessmentPort';

export const ThreatKindEndUser = 'EndUserThreat';
export const ThreatKindHostedInfra = 'HostedInfraThreat';
export const ThreatKindChainFork = 'ChainForkThreat';
