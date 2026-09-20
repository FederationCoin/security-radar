import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppComponent } from './app.component';
import { RadarApi } from './radar.api';
import { describe, expect, it, vi } from 'vitest';

describe('AppComponent', () => {
  async function setup() {
    const snack = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        RadarApi,
        { provide: MatSnackBar, useValue: snack },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, api: TestBed.inject(RadarApi), router: TestBed.inject(Router), snack };
  }

  it('has an account icon, tab nav, and no per-page signature dialog', async () => {
    const { fixture } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Maintainer signature');
    expect(el.querySelector('textarea')).toBeNull();
    const account = el.querySelector('a.account') as HTMLAnchorElement;
    expect(account.getAttribute('aria-label')).toBe('Maintainer login');
    expect(account.getAttribute('href')).toContain('login');
    expect(el.textContent).toContain('Radar');
    expect(el.textContent).toContain('BIPs');
    expect(el.textContent).toContain('PQ clock');
    expect(el.textContent).toContain('Tasks');
    expect(el.textContent).toContain('What we changed');
  });

  it('links footer socials', async () => {
    const { fixture } = await setup();
    const hrefs = [...fixture.nativeElement.querySelectorAll('footer a')].map((a: HTMLAnchorElement) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://github.com/FederationCoin',
      'https://github.com/FederationCoin/security-radar',
      'https://x.com/GFCNOrg',
    ]);
  });

  it('fills the account control when a tab envelope is stored', async () => {
    const { fixture, api } = await setup();
    api.signature.set('Bearer tok');
    fixture.detectChanges();
    const account = (fixture.nativeElement as HTMLElement).querySelector('a.account') as HTMLAnchorElement;
    expect(account.getAttribute('aria-label')).toBe('Maintainer');
  });

  it('opens a snack-bar when toast is set', async () => {
    const { fixture, api, snack } = await setup();
    api.toast.set('hello');
    fixture.detectChanges();
    expect(snack.open).toHaveBeenCalledWith('hello', 'Dismiss', expect.objectContaining({ duration: 5000 }));
  });

  it('does not open a snack-bar for an empty toast', async () => {
    const { snack } = await setup();
    expect(snack.open).not.toHaveBeenCalled();
  });

  it('passes a return query only for non-home, non-login URLs', async () => {
    const { fixture, router } = await setup();
    const comp = fixture.componentInstance;
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/' });
    expect(comp.loginReturn).toEqual({});
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/login' });
    expect(comp.loginReturn).toEqual({});
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/tasks' });
    expect(comp.loginReturn).toEqual({ return: '/tasks' });
    Object.defineProperty(router, 'url', { configurable: true, get: () => '' });
    expect(comp.loginReturn).toEqual({});
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/tasks?x=1' });
    expect(comp.loginReturn).toEqual({ return: '/tasks' });
  });

  it('marks tab routes active including nested and empty home', async () => {
    const { fixture, router } = await setup();
    const comp = fixture.componentInstance;
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/' });
    expect(comp.isActive('/')).toBe(true);
    expect(comp.isActive('/bips')).toBe(false);
    Object.defineProperty(router, 'url', { configurable: true, get: () => '' });
    expect(comp.isActive('/')).toBe(true);
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/bips' });
    expect(comp.isActive('/')).toBe(false);
    expect(comp.isActive('/bips')).toBe(true);
    Object.defineProperty(router, 'url', { configurable: true, get: () => '/events/abc' });
    expect(comp.isActive('/')).toBe(false);
  });
});
