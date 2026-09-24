import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BipsPage } from './bips.page';
import { ClockPage } from './clock.page';
import { TasksPage } from './tasks.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('catalog pages', () => {
  it('renders bips, clock, and empty tasks', async () => {
    const api = {
      listBips: vi.fn().mockResolvedValue([{ id: 'b', number: 9, title: 'Version bits', summary: 's' }]),
      getClock: vi.fn().mockResolvedValue({
        id: 'c',
        summary: 'PQ',
        milestones: [{ id: 'm', at: '2035', label: 'watch' }],
      }),
      listTasks: vi.fn().mockResolvedValue([{ id: 't', title: 'patch', complete: true }]),
      signedIn: () => false,
      reviewBip: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    await bips.whenStable();
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('BIP 9');
    expect(bips.nativeElement.textContent).toContain('No maintainer write-up yet');
    expect(bips.nativeElement.textContent).toContain('Understanding');
    expect(bips.nativeElement.querySelector('form')).toBeNull();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('PQ');
    expect(clock.nativeElement.textContent).toContain('watch');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const tasks = TestBed.createComponent(TasksPage);
    await tasks.whenStable();
    tasks.detectChanges();
    expect(tasks.nativeElement.textContent).toContain('patch');
    expect(tasks.nativeElement.textContent).toContain('Done');
  });

  it('shows a signed-in BIP form and posts understanding plus applicability', async () => {
    const api = {
      listBips: vi.fn().mockResolvedValue([
        {
          id: 'b',
          number: 9,
          title: 'Version bits',
          summary: 's',
          whatItDoes: 'bits',
          howItHitsUs: 'we watch',
          honorNotes: 'We honor this BIP.',
          ethosNotes: 'cheap nodes',
        },
      ]),
      signedIn: () => true,
      reviewBip: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BipsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('bits');
    expect(fixture.nativeElement.textContent).toContain('we watch');
    expect(fixture.nativeElement.textContent).toContain('We honor this BIP.');
    expect(fixture.nativeElement.textContent).toContain('cheap nodes');
    const form = fixture.componentInstance.formFor('b');
    form.controls.honor.setValue(true);
    form.controls.implement.setValue(true);
    fixture.componentInstance.submit('b');
    expect(api.reviewBip).toHaveBeenCalledWith({
      bipId: 'b',
      understanding: 'bits',
      applicability: 'we watch',
      honor: true,
      implement: true,
    });
    fixture.componentInstance.submit('missing');
    expect(api.reviewBip).toHaveBeenCalledTimes(1);
    form.controls.understanding.setValue('');
    fixture.componentInstance.submit('b');
    expect(form.touched).toBe(true);
    expect(api.reviewBip).toHaveBeenCalledTimes(1);
  });

  it('renders an empty timeline when the clock has no milestones', async () => {
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [
        provideNoopAnimations(),
        {
          provide: RadarApi,
          useValue: { getClock: vi.fn().mockResolvedValue({ id: 'c', summary: 'PQ', milestones: [] }) },
        },
      ],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('No milestones');
  });

  it('treats a 204 clock as not configured, not an error', async () => {
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: { getClock: vi.fn().mockResolvedValue(undefined) } }],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('Clock is not configured');
    expect(clock.nativeElement.textContent).not.toContain('Could not load clock');
  });

  it('shows empty BIP copy', async () => {
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: { listBips: vi.fn().mockResolvedValue([]), signedIn: () => false } }],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    await bips.whenStable();
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('No BIPs');
  });

  it('shows loading on catalog pages until the GET settles', async () => {
    let resolveBips!: (v: unknown[]) => void;
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [
        provideNoopAnimations(),
        {
          provide: RadarApi,
          useValue: {
            listBips: vi.fn().mockImplementation(() => new Promise((r) => (resolveBips = r))),
            signedIn: () => false,
          },
        },
      ],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('Loading');
    resolveBips([]);
    await new Promise((r) => setTimeout(r, 0));
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('No BIPs');

    let resolveClock!: (v: undefined) => void;
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [
        provideNoopAnimations(),
        { provide: RadarApi, useValue: { getClock: vi.fn().mockImplementation(() => new Promise((r) => (resolveClock = r))) } },
      ],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('Loading');
    resolveClock(undefined);
    await new Promise((r) => setTimeout(r, 0));
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('Clock is not configured');
  });

  it('renders catalog errors', async () => {
    const api = {
      listBips: vi.fn().mockRejectedValue(new Error('x')),
      getClock: vi.fn().mockRejectedValue(new Error('x')),
      listTasks: vi.fn().mockRejectedValue(new Error('x')),
      signedIn: () => false,
    };
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    await bips.whenStable();
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('Could not load BIPs');
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('Could not load clock');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const tasks = TestBed.createComponent(TasksPage);
    await tasks.whenStable();
    tasks.detectChanges();
    expect(tasks.nativeElement.textContent).toContain('Could not load tasks');
  });
});
