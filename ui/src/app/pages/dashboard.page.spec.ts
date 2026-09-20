import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DashboardPage } from './dashboard.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('DashboardPage', () => {
  it('shows empty copy when the API returns no events', async () => {
    const api = { listEvents: vi.fn().mockResolvedValue([]) };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No public events yet');
    expect(fixture.nativeElement.textContent).not.toContain('Loading');
    expect(fixture.nativeElement.textContent).toContain('No counts yet');
  });

  it('shows loading until the GET settles', async () => {
    let resolve!: (items: Array<{ type: string; id: string; createdAt: string }>) => void;
    const api = {
      listEvents: vi.fn().mockImplementation(
        () =>
          new Promise<Array<{ type: string; id: string; createdAt: string }>>((r) => {
            resolve = r;
          }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading');
    resolve([]);
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No public events yet');
  });

  it('shows an error when intel fails', async () => {
    const api = { listEvents: vi.fn().mockRejectedValue(new Error('nope')) };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load intel');
  });

  it('lists headlines and kind labels, not enum names or ids', async () => {
    const api = {
      listEvents: vi.fn().mockResolvedValue([
        {
          type: 'BipArrivedEvent',
          id: 'evt-uuid-should-hide',
          createdAt: 't',
          headline: 'BIP 9 — Version bits',
          blurb: 'soft fork bits',
          sourceUrl: 'https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki',
        },
      ]),
    };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('BIP 9 — Version bits');
    expect(text).toContain('BIP arrived');
    expect(text).not.toContain('BipArrivedEvent');
    expect(text).not.toContain('evt-uuid-should-hide');
    const source = fixture.nativeElement.querySelector('a[href*="bip-0009"]') as HTMLAnchorElement;
    expect(source.textContent).toContain('Source');
  });

  it('falls back to generic copy when a headline is missing', async () => {
    const api = {
      listEvents: vi.fn().mockResolvedValue([{ type: 'MissingDepScanEvent', id: 'hidden', createdAt: 't' }]),
    };
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Public intel');
    expect(fixture.nativeElement.textContent).toContain('A public radar event.');
    expect(fixture.nativeElement.textContent).not.toContain('hidden');
  });
});
