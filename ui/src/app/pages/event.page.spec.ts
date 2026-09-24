import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { EventPage } from './event.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('EventPage', () => {
  async function setup(event: unknown, signedIn: boolean) {
    const api = {
      getEvent: vi.fn().mockResolvedValue(event),
      ack: vi.fn().mockResolvedValue(undefined),
      signedIn: () => signedIn,
    };
    await TestBed.configureTestingModule({
      imports: [EventPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: RadarApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'e1' } } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  }

  it('hides Ack when the visitor has no tab envelope', async () => {
    const { fixture, api } = await setup(
      { type: 'DistantFeedEvent', id: 'e1', createdAt: 't', headline: 'Feed item', blurb: 'n' },
      false,
    );
    expect(fixture.nativeElement.textContent).toContain('Distant feed');
    expect(fixture.nativeElement.textContent).not.toContain('DistantFeedEvent');
    expect(fixture.nativeElement.textContent).not.toContain('Ack distant feed');
    fixture.componentInstance.ack();
    expect(api.ack).toHaveBeenCalledWith('e1');
  });

  it('shows Ack on a distant feed when signed in', async () => {
    const { fixture, api } = await setup(
      { type: 'DistantFeedEvent', id: 'e1', createdAt: 't', headline: 'Feed item', blurb: 'n' },
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('Ack distant feed');
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(api.ack).toHaveBeenCalledWith('e1');
  });

  it('does not show Ack on a non-distant event even when signed in', async () => {
    const { fixture } = await setup(
      { type: 'BipArrivedEvent', id: 'e1', createdAt: 't', headline: 'BIP 9 — Version bits' },
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('BIP 9 — Version bits');
    expect(fixture.nativeElement.textContent).not.toContain('Ack distant feed');
    expect(fixture.nativeElement.textContent).not.toContain('BipArrivedEvent');
  });

  it('falls back to generic copy when there is no headline', async () => {
    const { fixture } = await setup({ type: 'BipArrivedEvent', id: 'only-id', createdAt: 't' }, false);
    expect(fixture.nativeElement.textContent).toContain('Public intel');
    expect(fixture.nativeElement.textContent).not.toContain('only-id');
  });

  it('shows a source link when present', async () => {
    const { fixture } = await setup(
      {
        type: 'BipArrivedEvent',
        id: 'e1',
        createdAt: 't',
        headline: 'BIP 9',
        sourceUrl: 'https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki',
      },
      false,
    );
    expect(fixture.nativeElement.querySelector('a[href*="bip-0009"]')).not.toBeNull();
  });

  it('shows not found and does not ack without an event', async () => {
    const api = { getEvent: vi.fn().mockRejectedValue(new Error('404')), ack: vi.fn(), signedIn: () => true };
    await TestBed.configureTestingModule({
      imports: [EventPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: RadarApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Event not found');
    fixture.componentInstance.ack();
    expect(api.ack).not.toHaveBeenCalled();
  });
});
