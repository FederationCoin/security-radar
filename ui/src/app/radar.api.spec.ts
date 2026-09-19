import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RadarApi, ApiBase } from './radar.api';
import { describe, expect, it, beforeEach } from 'vitest';

describe('RadarApi', () => {
  let api: RadarApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RadarApi],
    });
    api = TestBed.inject(RadarApi);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists public events and records a toast when ack has no signature', async () => {
    const p = api.listEvents();
    http.expectOne(`${ApiBase}/intel/events`).flush({ items: [{ type: 'BipArrivedEvent', id: '1', createdAt: 't' }] });
    expect((await p).length).toBe(1);
    await api.ack('1');
    expect(api.toast()).toContain('Paste');
  });

  it('acks with a bearer and reports failure', async () => {
    api.signature.set('eyJ');
    const p = api.ack('1');
    const req = http.expectOne(`${ApiBase}/feeds/ack`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer eyJ');
    req.flush('no', { status: 401, statusText: 'Unauthorized' });
    await p;
    expect(api.toast()).toContain('Taproot');
  });

  it('loads bips, clock, tasks, event, and successful ack', async () => {
    const bipsP = api.listBips();
    http.expectOne(`${ApiBase}/intel/bips`).flush({ items: [] });
    expect(await bipsP).toEqual([]);
    const clockP = api.getClock();
    http.expectOne(`${ApiBase}/intel/quantum-clock`).flush({ id: 'c', summary: 'pq', milestones: [] });
    expect((await clockP).id).toBe('c');
    const tasksP = api.listTasks();
    http.expectOne(`${ApiBase}/intel/tasks`).flush({ items: [] });
    expect(await tasksP).toEqual([]);
    const evP = api.getEvent('e');
    http.expectOne(`${ApiBase}/intel/events/e`).flush({ type: 'BipArrivedEvent', id: 'e', createdAt: 't' });
    expect((await evP).id).toBe('e');
    api.signature.set('Bearer tok');
    const ackP = api.ack('e');
    http.expectOne(`${ApiBase}/feeds/ack`).flush({ ok: true });
    await ackP;
    expect(api.toast()).toContain('acked');
  });
});
