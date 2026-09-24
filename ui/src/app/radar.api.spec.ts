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
    const empty = api.listEvents();
    http.expectOne(`${ApiBase}/intel/events`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await empty).toEqual([]);
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
    http.expectOne(`${ApiBase}/intel/bips`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await bipsP).toEqual([]);
    const clockEmpty = api.getClock();
    http.expectOne(`${ApiBase}/intel/quantum-clock`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await clockEmpty).toBeUndefined();
    const clockP = api.getClock();
    http.expectOne(`${ApiBase}/intel/quantum-clock`).flush({ id: 'c', summary: 'pq', milestones: [] });
    expect((await clockP)?.id).toBe('c');
    const tasksP = api.listTasks();
    http.expectOne(`${ApiBase}/intel/tasks`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await tasksP).toEqual([]);
    const tasksEmpty200 = api.listTasks();
    http.expectOne(`${ApiBase}/intel/tasks`).flush({ items: [] });
    expect(await tasksEmpty200).toEqual([]);
    const evP = api.getEvent('e');
    http.expectOne(`${ApiBase}/intel/events/e`).flush({ type: 'BipArrivedEvent', id: 'e', createdAt: 't' });
    expect((await evP).id).toBe('e');
    api.signature.set('Bearer tok');
    expect(api.signedIn()).toBe(true);
    const ackP = api.ack('e');
    http.expectOne(`${ApiBase}/feeds/ack`).flush({ ok: true });
    await ackP;
    expect(api.toast()).toContain('acked');
  });

  it('treats whitespace-only paste as signed out', () => {
    api.signature.set('   ');
    expect(api.signedIn()).toBe(false);
  });

  it('accepts a task with a bearer and reports failure', async () => {
    await api.acceptTask('t1');
    expect(api.toast()).toContain('Paste');
    api.signature.set('tok');
    const ok = api.acceptTask('t1');
    const req = http.expectOne(`${ApiBase}/tasks/accept`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.request.body).toEqual({ taskId: 't1' });
    req.flush({ ok: true });
    await ok;
    expect(api.toast()).toContain('accepted');
    const fail = api.acceptTask('t1');
    http.expectOne(`${ApiBase}/tasks/accept`).flush('no', { status: 401, statusText: 'Unauthorized' });
    await fail;
    expect(api.toast()).toContain('Accept failed');
  });

  it('completes a task without clearing a vuln flag in the toast', async () => {
    api.signature.set('Bearer tok');
    const ok = api.completeTask('t1');
    http.expectOne(`${ApiBase}/tasks/complete`).flush({ ok: true });
    await ok;
    expect(api.toast()).toContain('does not clear a vuln flag');
    const fail = api.completeTask('t1');
    http.expectOne(`${ApiBase}/tasks/complete`).flush('no', { status: 401, statusText: 'Unauthorized' });
    await fail;
    expect(api.toast()).toContain('Complete failed');
  });

  it('reviews a BIP with understanding and applicability', async () => {
    api.signature.set('tok');
    const body = {
      bipId: 'b',
      understanding: 'what',
      applicability: 'how',
      honor: true,
      implement: false,
    };
    const ok = api.reviewBip(body);
    const req = http.expectOne(`${ApiBase}/bips/review`);
    expect(req.request.body).toEqual(body);
    req.flush({ ok: true });
    await ok;
    expect(api.toast()).toContain('BIP review stored');
    const fail = api.reviewBip(body);
    http.expectOne(`${ApiBase}/bips/review`).flush('no', { status: 401, statusText: 'Unauthorized' });
    await fail;
    expect(api.toast()).toContain('Review failed');
  });
});
