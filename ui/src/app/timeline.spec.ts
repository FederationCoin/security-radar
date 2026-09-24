import { TestBed } from '@angular/core/testing';
import { TimelineComponent } from './timeline';
import { describe, expect, it } from 'vitest';

describe('TimelineComponent', () => {
  it('shows empty copy when there are no milestones', async () => {
    await TestBed.configureTestingModule({ imports: [TimelineComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TimelineComponent);
    fixture.componentInstance.milestones = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No milestones');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('renders each milestone', async () => {
    await TestBed.configureTestingModule({ imports: [TimelineComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TimelineComponent);
    fixture.componentInstance.milestones = [{ id: 'm', at: '2035', label: 'CRQC watch' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2035');
    expect(fixture.nativeElement.textContent).toContain('CRQC watch');
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });
});
