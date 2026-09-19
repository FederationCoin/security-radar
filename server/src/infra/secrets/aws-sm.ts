import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { SecretStore } from '../../ports/secret-store';

export class AwsSecretsManagerSecretStore<T> implements SecretStore<T> {
  constructor(
    private readonly secretId: string,
    private readonly client = new SecretsManagerClient({}),
  ) {}

  async load(): Promise<T> {
    const out = await this.client.send(new GetSecretValueCommand({ SecretId: this.secretId }));
    if (!out.SecretString) {
      throw new Error('Radar secret is empty');
    }
    return JSON.parse(out.SecretString) as T;
  }
}
