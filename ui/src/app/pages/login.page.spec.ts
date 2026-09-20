import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginPage } from './login.page';
import { RadarApi } from '../radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('LoginPage', () => {
  async function setup(returnUrl: string | null) {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        RadarApi,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'return' ? returnUrl : null) } } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return { fixture, api: TestBed.inject(RadarApi), nav, http: TestBed.inject(HttpTestingController) };
  }

  it('stores an envelope in the tab and navigates home without a signed GET', async () => {
    const { fixture, api, nav, http } = await setup(null);
    const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = '  Bearer abc  ';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(api.signature()).toBe('Bearer abc');
    expect(api.signedIn()).toBe(true);
    expect(api.toast()).toContain('this tab only');
    expect(nav).toHaveBeenCalledWith('/');
    http.verify();
  });

  it('navigates to a same-origin return path', async () => {
    const { fixture, nav } = await setup('/tasks');
    fixture.componentInstance.form.controls.envelope.setValue('tok');
    fixture.componentInstance.save();
    expect(nav).toHaveBeenCalledWith('/tasks');
  });

  it('rejects protocol-relative and login return URLs', async () => {
    const { fixture, nav } = await setup('//evil.example/phish');
    fixture.componentInstance.form.controls.envelope.setValue('tok');
    fixture.componentInstance.save();
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('rejects a return to /login', async () => {
    const { fixture, nav } = await setup('/login');
    fixture.componentInstance.form.controls.envelope.setValue('tok');
    fixture.componentInstance.save();
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('clears an empty paste without navigating', async () => {
    const { fixture, api, nav } = await setup('/tasks');
    const ta = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = '   ';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(api.signedIn()).toBe(false);
    expect(api.toast()).toContain('cleared');
    expect(nav).not.toHaveBeenCalled();
  });

  it('shows Clear only when signed in and clearing stays on the page', async () => {
    const { fixture, api, nav } = await setup(null);
    expect(fixture.nativeElement.textContent).not.toContain('Clear');
    api.signature.set('tok');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Clear');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toContain('Clear');
    buttons.find((b) => b.textContent?.trim() === 'Clear')!.click();
    fixture.detectChanges();
    expect(api.signedIn()).toBe(false);
    expect(api.toast()).toContain('cleared');
    expect(nav).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Clear');
  });
});
