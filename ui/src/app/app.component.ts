import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RadarApi } from './radar.api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, FormsModule],
  template: `
    <header>
      <nav>
        <a routerLink="/">Radar</a>
        <a routerLink="/bips">BIPs</a>
        <a routerLink="/clock">PQ clock</a>
        <a routerLink="/tasks">Tasks</a>
        <a routerLink="/changed">What we changed</a>
      </nav>
    </header>
    <main>
      @if (api.toast()) {
        <p class="toast">{{ api.toast() }}</p>
      }
      <router-outlet />
      <section class="dialog">
        <h2>Maintainer signature</h2>
        <p>Paste Electrum compact 64-hex or a Bearer envelope. No cookie session. Dummy MAIN unused.</p>
        <textarea [(ngModel)]="sig" placeholder="Bearer eyJ..."></textarea>
        <button type="button" (click)="save()">Use signature</button>
      </section>
    </main>
  `,
})
export class AppComponent {
  sig = '';
  constructor(readonly api: RadarApi) {}
  save(): void {
    this.api.signature.set(this.sig.trim());
    this.api.toast.set(this.sig.trim() ? 'Signature stored in this tab only.' : 'Signature cleared.');
  }
}
