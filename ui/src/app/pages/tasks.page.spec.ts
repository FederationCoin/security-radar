import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TasksPage } from './tasks.page';
import { RadarApi, type RadarTask } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('TasksPage', () => {
  async function setup(
    tasks: RadarTask[],
    signedIn: boolean,
    list: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(tasks),
  ) {
    const api = {
      listTasks: list,
      acceptTask: vi.fn().mockResolvedValue(undefined),
      completeTask: vi.fn().mockResolvedValue(undefined),
      signedIn: () => signedIn,
    };
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: RadarApi, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TasksPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  }

  it('lists tasks without Accept or Complete when unsigned', async () => {
    const { fixture } = await setup([{ id: 't1', title: 'Patch', complete: false }], false);
    expect(fixture.nativeElement.textContent).toContain('Patch');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('t1');
  });

  it('shows Accept and Complete on open tasks when signed in', async () => {
    const { fixture, api } = await setup([{ id: 't1', title: 'Patch', complete: false }], true);
    const labels = [...fixture.nativeElement.querySelectorAll('button')].map((b: HTMLButtonElement) => b.textContent?.trim());
    expect(labels).toEqual(['Accept', 'Complete']);
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons[0].click();
    buttons[1].click();
    expect(api.acceptTask).toHaveBeenCalledWith('t1');
    expect(api.completeTask).toHaveBeenCalledWith('t1');
  });

  it('shows Accepted and hides Accept after a maintainer takes the task', async () => {
    const open = { id: 't1', title: 'Patch', complete: false, accepted: false };
    const taken = { id: 't1', title: 'Patch', complete: false, accepted: true };
    const list = vi.fn().mockResolvedValueOnce([open]).mockResolvedValue([taken]);
    const { fixture } = await setup([open], true, list);
    const accept = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Accept',
    ) as HTMLButtonElement;
    accept.click();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Accepted');
    const labels = [...fixture.nativeElement.querySelectorAll('button')].map((b: HTMLButtonElement) => b.textContent?.trim());
    expect(labels).toEqual(['Complete']);
  });

  it('shows Accepted without buttons when unsigned', async () => {
    const { fixture } = await setup([{ id: 't1', title: 'Patch', complete: false, accepted: true }], false);
    expect(fixture.nativeElement.textContent).toContain('Accepted');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('hides action buttons on a completed task even when signed in', async () => {
    const { fixture } = await setup([{ id: 't1', title: 'Patch', complete: true }], true);
    expect(fixture.nativeElement.textContent).toContain('Done');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('shows empty copy', async () => {
    const { fixture } = await setup([], false);
    expect(fixture.nativeElement.textContent).toContain('No tasks');
    expect(fixture.nativeElement.textContent).toContain('No counts yet');
  });

  it('shows an error when the list fails', async () => {
    const { fixture } = await setup([], false, vi.fn().mockRejectedValue(new Error('nope')));
    expect(fixture.nativeElement.textContent).toContain('Could not load tasks');
  });

  it('shows loading until the GET settles', async () => {
    let resolve!: (items: RadarTask[]) => void;
    const list = vi.fn().mockImplementation(
      () => new Promise<RadarTask[]>((r) => (resolve = r)),
    );
    await TestBed.configureTestingModule({
      imports: [TasksPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: RadarApi,
          useValue: { listTasks: list, acceptTask: vi.fn(), completeTask: vi.fn(), signedIn: () => false },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TasksPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading');
    resolve([]);
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tasks');
  });
});
