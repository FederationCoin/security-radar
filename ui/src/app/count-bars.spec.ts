import { TestBed } from '@angular/core/testing';
import { CountBarsComponent } from './count-bars';
import { describe, expect, it } from 'vitest';

describe('CountBarsComponent', () => {
  it('shows empty copy when there are no rows', async () => {
    await TestBed.configureTestingModule({ imports: [CountBarsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CountBarsComponent);
    fixture.componentInstance.rows = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No counts yet');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('renders a bar for each row', async () => {
    await TestBed.configureTestingModule({ imports: [CountBarsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CountBarsComponent);
    fixture.componentInstance.rows = [
      { label: 'BIP arrived', count: 4 },
      { label: 'Distant feed', count: 1 },
    ];
    fixture.componentInstance.caption = 'By kind';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('BIP arrived');
    expect(fixture.nativeElement.querySelector('svg')?.getAttribute('aria-label')).toBe('By kind');
    expect(fixture.componentInstance.barWidth(4)).toBe(200);
    expect(fixture.componentInstance.barWidth(1)).toBe(50);
  });
});
