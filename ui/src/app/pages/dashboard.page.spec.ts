import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('DashboardPage', () => {
  it('shows empty copy when the API returns no events', async () => {
    const api = { listEvents: vi.fn().mockResolvedValue([]) };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No public events yet');
  });

  it('shows an error when intel fails', async () => {
    const api = { listEvents: vi.fn().mockRejectedValue(new Error('nope')) };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load intel');
  });

  it('lists events', async () => {
    const api = { listEvents: vi.fn().mockResolvedValue([{ type: 'BipArrivedEvent', id: '1', createdAt: 't' }]) };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('BipArrivedEvent');
  });
});
