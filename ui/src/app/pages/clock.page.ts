import { Component, inject, signal } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { RadarApi, type QuantumClock } from '../radar.api';
import { TimelineComponent } from '../timeline';

@Component({
  selector: 'app-clock',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, TimelineComponent],
  template: `
    <h1>PQ clock</h1>
    @if (loading()) {
      <p>Loading…</p>
    }
    @if (!loading() && error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (!loading() && !error() && !clock()) {
      <mat-card>
        <mat-card-content>
          <p>Clock is not configured.</p>
        </mat-card-content>
      </mat-card>
    }
    @if (clock()) {
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ clock()!.summary }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <app-timeline [milestones]="clock()!.milestones" />
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class ClockPage {
  private readonly api = inject(RadarApi);
  readonly clock = signal<QuantumClock | undefined>(undefined);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    void this.api
      .getClock()
      .then((c) => this.clock.set(c))
      .catch(() => this.error.set('Could not load clock.'))
      .finally(() => this.loading.set(false));
  }
}
