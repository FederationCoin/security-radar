import { describe, expect, it } from 'vitest';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AwsSecretsManagerSecretStore } from './aws-sm';

describe('AwsSecretsManagerSecretStore', () => {
  it('JSON-parses SecretString', async () => {
    const store = new AwsSecretsManagerSecretStore<{ corsOrigins: string[] }>('federationcoin/radar-api', {
      send: async (cmd: unknown) => {
        expect(cmd).toBeInstanceOf(GetSecretValueCommand);
        return { SecretString: JSON.stringify({ corsOrigins: ['https://radar.federationcoin.org'] }) };
      },
    } as never);
    expect((await store.load()).corsOrigins).toEqual(['https://radar.federationcoin.org']);
  });

  it('throws when SecretString is empty', async () => {
    const store = new AwsSecretsManagerSecretStore('federationcoin/radar-api', {
      send: async () => ({ SecretString: undefined }),
    } as never);
    await expect(store.load()).rejects.toThrow('Radar secret is empty');
  });
});
