import { Injectable, signal } from '@angular/core';
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
  title?: string;
  summary?: string;
  present?: boolean;
  acked?: boolean;
  taskComplete?: boolean;
};

@Injectable({ providedIn: 'root' })
export class RadarApi {
  readonly toast = signal('');
  readonly signature = signal('');

  constructor(private readonly http: HttpClient) {}

  private headers(signed: boolean): HttpHeaders {
    let h = new HttpHeaders({ 'X-FederationCoin-Chain': 'testnet' });
    if (signed && this.signature()) {
      h = h.set('Authorization', this.signature().startsWith('Bearer ') ? this.signature() : `Bearer ${this.signature()}`);
    }
    return h;
  }

  async listEvents(): Promise<PublicEvent[]> {
    const body = await firstValueFrom(
      this.http.get<{ items: PublicEvent[] }>(`${ApiBase}/intel/events`, { headers: this.headers(false) }),
    );
    return body.items;
  }

  async getEvent(id: string): Promise<PublicEvent> {
    return firstValueFrom(this.http.get<PublicEvent>(`${ApiBase}/intel/events/${id}`, { headers: this.headers(false) }));
  }

  async listBips(): Promise<Array<{ id: string; number: number; title: string; summary: string }>> {
    const body = await firstValueFrom(
      this.http.get<{ items: Array<{ id: string; number: number; title: string; summary: string }> }>(
        `${ApiBase}/intel/bips`,
        { headers: this.headers(false) },
      ),
    );
    return body.items;
  }

  async getClock(): Promise<{ id: string; summary: string; milestones: Array<{ id: string; at: string; label: string }> }> {
    return firstValueFrom(
      this.http.get<{ id: string; summary: string; milestones: Array<{ id: string; at: string; label: string }> }>(
        `${ApiBase}/intel/quantum-clock`,
        { headers: this.headers(false) },
      ),
    );
  }

  async listTasks(): Promise<Array<{ id: string; title: string; complete: boolean }>> {
    const body = await firstValueFrom(
      this.http.get<{ items: Array<{ id: string; title: string; complete: boolean }> }>(`${ApiBase}/intel/tasks`, {
        headers: this.headers(false),
      }),
    );
    return body.items;
  }

  async ack(eventId: string): Promise<void> {
    if (!this.signature()) {
      this.toast.set('Paste a Sparrow compact signature first.');
      return;
    }
    try {
      await firstValueFrom(
        this.http.post(`${ApiBase}/feeds/ack`, { eventId }, { headers: this.headers(true) }),
      );
      this.toast.set('Distant feed acked.');
    } catch {
      this.toast.set('Ack failed. Taproot is rejected; signer must be a maintainer.');
    }
  }
}
