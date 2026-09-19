import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RadarApi, type PublicEvent } from '../radar.api';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <h1>Public intel</h1>
    <p>Already-public vulns, org drift, BIPs, PQ clock, assessed upstream, acked feeds. Unacked distant stays off this list.</p>
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (events().length === 0 && !error()) {
      <p>No public events yet.</p>
    }
    <ul>
      @for (e of events(); track e.id) {
        <li>
          <a [routerLink]="['/events', e.id]">{{ e.type }} {{ e.id }}</a>
        </li>
      }
    </ul>
  `,
})
export class DashboardPage {
  private readonly api = inject(RadarApi);
  readonly events = signal<PublicEvent[]>([]);
  readonly error = signal('');

  constructor() {
    void this.api
      .listEvents()
      .then((items) => this.events.set(items))
      .catch(() => this.error.set('Could not load intel.'));
  }
}
