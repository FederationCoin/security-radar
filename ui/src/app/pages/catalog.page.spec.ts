import { TestBed } from '@angular/core/testing';
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
    };
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    await bips.whenStable();
    bips.detectChanges();
    expect(bips.nativeElement.textContent).toContain('BIP 9');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('PQ');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const tasks = TestBed.createComponent(TasksPage);
    await tasks.whenStable();
    tasks.detectChanges();
    expect(tasks.nativeElement.textContent).toContain('patch');
    expect(tasks.nativeElement.textContent).toContain('done');
  });

  it('renders catalog errors', async () => {
    const api = {
      listBips: vi.fn().mockRejectedValue(new Error('x')),
      getClock: vi.fn().mockRejectedValue(new Error('x')),
      listTasks: vi.fn().mockRejectedValue(new Error('x')),
    };
    await TestBed.configureTestingModule({
      imports: [BipsPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const bips = TestBed.createComponent(BipsPage);
    await bips.whenStable();
    bips.detectChanges();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const clock = TestBed.createComponent(ClockPage);
    await clock.whenStable();
    clock.detectChanges();
    expect(clock.nativeElement.textContent).toContain('Clock is not configured');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [{ provide: RadarApi, useValue: api }],
    }).compileComponents();
    const tasks = TestBed.createComponent(TasksPage);
    await tasks.whenStable();
    tasks.detectChanges();
    expect(tasks.nativeElement.textContent).toContain('Could not load tasks');
  });
});
