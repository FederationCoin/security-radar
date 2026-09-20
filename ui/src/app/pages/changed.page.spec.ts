import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ChangedPage } from './changed.page';
import { describe, expect, it } from 'vitest';

describe('ChangedPage', () => {
  it('renders the epic 7 stub without calling health', async () => {
    await TestBed.configureTestingModule({
      imports: [ChangedPage],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChangedPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('What we changed');
    expect(fixture.nativeElement.textContent).not.toContain('healthz');
  });
});
