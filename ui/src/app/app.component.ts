import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { MatTabNav, MatTabLink, MatTabNavPanel } from '@angular/material/tabs';
import { MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RadarApi } from './radar.api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatToolbar, MatTabNav, MatTabLink, MatTabNavPanel, MatIconButton],
  template: `
    <div class="radar-shell">
      <mat-toolbar class="radar-bar">
        <span class="brand">FederationCoin radar</span>
        <span class="spacer"></span>
        <a
          mat-icon-button
          class="account"
          routerLink="/login"
          [queryParams]="loginReturn"
          [attr.aria-label]="api.signedIn() ? 'Maintainer' : 'Maintainer login'"
        >
          @if (api.signedIn()) {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.75" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" stroke-width="1.75" />
            </svg>
          }
        </a>
      </mat-toolbar>
      <nav mat-tab-nav-bar [tabPanel]="panel">
        @for (l of links; track l.path) {
          <a mat-tab-link [routerLink]="l.path" [active]="isActive(l.path)">{{ l.label }}</a>
        }
      </nav>
      <mat-tab-nav-panel #panel>
        <main>
          <router-outlet />
        </main>
      </mat-tab-nav-panel>
      <footer>
        <a href="https://github.com/FederationCoin">GitHub</a>
        <a href="https://github.com/FederationCoin/security-radar">security-radar</a>
        <a href="https://x.com/GFCNOrg">X</a>
      </footer>
    </div>
  `,
})
export class AppComponent {
  readonly api = inject(RadarApi);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  readonly links = [
    { path: '/', label: 'Radar' },
    { path: '/bips', label: 'BIPs' },
    { path: '/clock', label: 'PQ clock' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/feeds', label: 'Feeds' },
    { path: '/changed', label: 'What we changed' },
  ];

  constructor() {
    effect(() => {
      const msg = this.api.toast();
      if (msg) {
        this.snack.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  get loginReturn(): { return?: string } {
    const u = this.router.url.split('?')[0];
    if (!u || u === '/' || u.startsWith('/login')) {
      return {};
    }
    return { return: u };
  }

  isActive(path: string): boolean {
    const u = this.router.url.split('?')[0];
    if (path === '/') {
      return u === '/' || u === '';
    }
    return u === path || u.startsWith(`${path}/`);
  }
}
