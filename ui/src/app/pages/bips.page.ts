import { Component, inject, signal } from '@angular/core';
import { RadarApi } from '../radar.api';

@Component({
  selector: 'app-bips',
  template: `
    <h1>BIPs</h1>
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    <ul>
      @for (b of bips(); track b.id) {
        <li>BIP {{ b.number }} — {{ b.title }}</li>
      }
    </ul>
  `,
})
export class BipsPage {
  private readonly api = inject(RadarApi);
  readonly bips = signal<Array<{ id: string; number: number; title: string; summary: string }>>([]);
  readonly error = signal('');
  constructor() {
    void this.api
      .listBips()
      .then((items) => this.bips.set(items))
      .catch(() => this.error.set('Could not load BIPs.'));
  }
}
