import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatAnchor } from '@angular/material/button';
import { RadarApi, type PublicEvent } from '../radar.api';
import { CountBarsComponent } from '../count-bars';
import { countsByKind, kindLabel } from '../kind-label';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatCardContent,
    MatCardActions,
    MatAnchor,
    CountBarsComponent,
  ],
  template: `
    <section class="hero">
      <img src="assets/join-the-federation-banner-2.png" alt="Join the Federation" />
      <h1>FederationCoin security radar</h1>
      <p class="lede">
        Money. Cheap nodes. To change is to fork. This radar is public intel on BIPs, feeds, and
        dependency drift. Dummy MAIN unused.
      </p>
    </section>
    @if (loading()) {
      <p>Loading…</p>
    }
    @if (!loading() && error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (!loading() && events().length === 0 && !error()) {
      <p>No public events yet.</p>
    }
    @if (!loading() && !error()) {
      <app-count-bars [rows]="kindCounts()" caption="Events by kind" />
    }
    <div class="card-grid">
      @for (e of events(); track e.id) {
        <mat-card class="intel-card" [routerLink]="['/events', e.id]">
          <mat-card-header>
            <mat-card-subtitle>{{ kindOf(e) }}</mat-card-subtitle>
            <mat-card-title>{{ e.headline || 'Public intel' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p>{{ e.blurb || e.summary || e.title || 'A public radar event.' }}</p>
          </mat-card-content>
          @if (e.sourceUrl) {
            <mat-card-actions>
              <a mat-button [href]="e.sourceUrl" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()">
                Source
              </a>
            </mat-card-actions>
          }
        </mat-card>
      }
    </div>
  `,
})
export class DashboardPage {
  private readonly api = inject(RadarApi);
  readonly events = signal<PublicEvent[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);

  constructor() {
    void this.api
      .listEvents()
      .then((items) => this.events.set(items))
      .catch(() => this.error.set('Could not load intel.'))
      .finally(() => this.loading.set(false));
  }

  kindOf(e: PublicEvent): string {
    return kindLabel(e.type);
  }

  kindCounts() {
    return countsByKind(this.events());
  }
}
