import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { EventPage } from './event.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('EventPage', () => {
  it('loads an event and acks', async () => {
    const api = {
      getEvent: vi.fn().mockResolvedValue({ type: 'DistantFeedEvent', id: 'e1', createdAt: 't', summary: 'n' }),
      ack: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [EventPage],
      providers: [
        provideRouter([]),
        { provide: RadarApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'e1' } } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('DistantFeedEvent');
    fixture.componentInstance.ack();
    expect(api.ack).toHaveBeenCalledWith('e1');
  });

  it('shows not found', async () => {
    const api = { getEvent: vi.fn().mockRejectedValue(new Error('404')), ack: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [EventPage],
      providers: [
        provideRouter([]),
        { provide: RadarApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'missing' } } } },
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
