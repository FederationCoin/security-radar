import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const localHost =
  typeof globalThis.location !== 'undefined' &&
  (globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1');

export const ApiBase = localHost
  ? `${globalThis.location.protocol}//${globalThis.location.hostname}:8080/v1`
  : 'https://radar-api.federationcoin.org/v1';

export type PublicEvent = {
  type: string;
  id: string;
  createdAt: string;
  headline?: string;
  blurb?: string;
  sourceUrl?: string;
  title?: string;
  summary?: string;
  present?: boolean;
  acked?: boolean;
  taskComplete?: boolean;
};

export type Bip = {
  id: string;
  number: number;
  title: string;
  summary: string;
  whatItDoes?: string;
  howItHitsUs?: string;
  honorNotes?: string;
  ethosNotes?: string;
};

export type RadarTask = { id: string; title: string; complete: boolean; accepted?: boolean };

export type ReviewBipBody = {
  bipId: string;
  understanding: string;
  applicability: string;
  honor: boolean;
  implement: boolean;
};

export type QuantumClock = {
  id: string;
  summary: string;
  milestones: Array<{ id: string; at: string; label: string }>;
};

@Injectable({ providedIn: 'root' })
export class RadarApi {
  readonly toast = signal('');
  readonly signature = signal('');
  readonly signedIn = computed(() => this.signature().trim().length > 0);

  constructor(private readonly http: HttpClient) {}

  private headers(signed: boolean): HttpHeaders {
    let h = new HttpHeaders({ 'X-FederationCoin-Chain': 'testnet' });
    if (signed && this.signature()) {
      h = h.set('Authorization', this.signature().startsWith('Bearer ') ? this.signature() : `Bearer ${this.signature()}`);
    }
    return h;
  }

  private async getOptional<T>(url: string): Promise<T | undefined> {
    const resp = await firstValueFrom(this.http.get<T>(url, { headers: this.headers(false), observe: 'response' }));
    if (resp.status === 204 || resp.body == null) {
      return undefined;
    }
    return resp.body;
  }

  private async getSignedItems<T>(url: string): Promise<T[]> {
    const body = await firstValueFrom(
      this.http.get<{ items: T[] }>(url, { headers: this.headers(true) }),
    );
    return body?.items ?? [];
  }

  private async getItems<T>(url: string): Promise<T[]> {
    const body = await this.getOptional<{ items: T[] }>(url);
    return body?.items ?? [];
  }

  async listEvents(): Promise<PublicEvent[]> {
    return this.getItems<PublicEvent>(`${ApiBase}/intel/events`);
  }

  async getEvent(id: string): Promise<PublicEvent> {
    return firstValueFrom(this.http.get<PublicEvent>(`${ApiBase}/intel/events/${id}`, { headers: this.headers(false) }));
  }

  async listBips(): Promise<Bip[]> {
    return this.getItems<Bip>(`${ApiBase}/intel/bips`);
  }

  async getClock(): Promise<QuantumClock | undefined> {
    return this.getOptional<QuantumClock>(`${ApiBase}/intel/quantum-clock`);
  }

  async listTasks(): Promise<RadarTask[]> {
    return this.getItems<RadarTask>(`${ApiBase}/intel/tasks`);
  }

  async ack(eventId: string): Promise<void> {
    await this.signedPost(`${ApiBase}/feeds/ack`, { eventId }, 'Distant feed acked.', 'Ack failed. Taproot is rejected; signer must be a maintainer.');
  }

  async acceptTask(taskId: string): Promise<void> {
    await this.signedPost(`${ApiBase}/tasks/accept`, { taskId }, 'Task accepted.', 'Accept failed. Taproot is rejected; signer must be a maintainer.');
  }

  async completeTask(taskId: string): Promise<void> {
    await this.signedPost(
      `${ApiBase}/tasks/complete`,
      { taskId },
      'Task completed. Complete does not clear a vuln flag.',
      'Complete failed. Taproot is rejected; signer must be a maintainer.',
    );
  }

  async listUnacked(): Promise<PublicEvent[]> {
    return this.getSignedItems<PublicEvent>(`${ApiBase}/intel/distant-unacked`);
  }

  async recordHuman(eventId: string, writeup: string): Promise<void> {
    await this.signedPost(`${ApiBase}/assessments/human`, { eventId, writeup }, 'Assessment stored.', 'Assessment failed.');
  }

  async recordNoFork(eventId: string, writeup: string): Promise<void> {
    await this.signedPost(`${ApiBase}/assessments/no-fork`, { eventId, writeup }, 'No-fork assessment stored.', 'Assessment failed.');
  }

  async recordSoftFork(eventId: string, writeup: string): Promise<void> {
    await this.signedPost(`${ApiBase}/assessments/soft-fork`, { eventId, writeup }, 'Soft-fork assessment stored.', 'Assessment failed.');
  }

  async recordHardFork(eventId: string, writeup: string): Promise<void> {
    await this.signedPost(`${ApiBase}/assessments/hard-fork`, { eventId, writeup }, 'Hard-fork assessment stored.', 'Assessment failed.');
  }

  async reviewBip(body: ReviewBipBody): Promise<void> {
    await this.signedPost(
      `${ApiBase}/bips/review`,
      body,
      'BIP review stored.',
      'Review failed. Taproot is rejected; signer must be a maintainer.',
    );
  }

  private async signedPost(url: string, body: object, ok: string, fail: string): Promise<void> {
    if (!this.signedIn()) {
      this.toast.set('Paste a Sparrow compact signature first.');
      return;
    }
    try {
      await firstValueFrom(this.http.post(url, body, { headers: this.headers(true) }));
      this.toast.set(ok);
    } catch {
      this.toast.set(fail);
    }
  }
}
