import { Component, inject, signal } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { RadarApi, type PublicEvent } from '../radar.api';

@Component({
  selector: 'app-feeds',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatButton],
  template: `
    <h1>Unacked feeds</h1>
    @if (!api.signedIn()) {
      <p>Sign in to see feeds that are not public yet.</p>
    }
    @if (api.signedIn() && error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (api.signedIn() && !error() && items().length === 0) {
      <p>No unacked feeds.</p>
    }
    <div class="card-grid">
      @for (e of items(); track e.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ e.headline || e.title || 'Distant feed' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p>{{ e.blurb || e.summary || '' }}</p>
            @if (api.signedIn()) {
              <button mat-flat-button type="button" (click)="ack(e.id)">Ack distant feed</button>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
})
export class FeedsPage {
  readonly api = inject(RadarApi);
  readonly items = signal<PublicEvent[]>([]);
  readonly error = signal('');

  constructor() {
    if (!this.api.signedIn()) {
      return;
    }
    void this.api
      .listUnacked()
      .then((rows) => this.items.set(rows))
      .catch(() => this.error.set('Could not load unacked feeds.'));
  }

  ack(id: string): void {
    void this.api.ack(id);
  }
}
