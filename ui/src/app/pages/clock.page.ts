import { Component, inject, signal } from '@angular/core';
import { RadarApi } from '../radar.api';

@Component({
  selector: 'app-clock',
  template: `
    <h1>PQ clock</h1>
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (clock()) {
      <p>{{ clock()!.summary }}</p>
      <ul>
        @for (m of clock()!.milestones; track m.id) {
          <li>{{ m.at }} — {{ m.label }}</li>
        }
      </ul>
    }
  `,
})
export class ClockPage {
  private readonly api = inject(RadarApi);
  readonly clock = signal<{ id: string; summary: string; milestones: Array<{ id: string; at: string; label: string }> } | undefined>(
    undefined,
  );
  readonly error = signal('');
  constructor() {
    void this.api
      .getClock()
      .then((c) => this.clock.set(c))
      .catch(() => this.error.set('Clock is not configured.'));
  }
}
