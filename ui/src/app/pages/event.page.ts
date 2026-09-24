import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatAnchor, MatButton } from '@angular/material/button';
import { RadarApi, type PublicEvent } from '../radar.api';
import { kindLabel } from '../kind-label';

@Component({
  selector: 'app-event',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions, MatButton, MatAnchor],
  template: `
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (ev()) {
      <mat-card>
        <mat-card-header>
          <mat-card-subtitle>{{ kindOf(ev()!) }}</mat-card-subtitle>
          <mat-card-title>{{ ev()!.headline || 'Public intel' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ ev()!.blurb || ev()!.summary || ev()!.title || 'A public radar event.' }}</p>
        </mat-card-content>
        <mat-card-actions>
          @if (ev()!.sourceUrl) {
            <a mat-button [href]="ev()!.sourceUrl" target="_blank" rel="noopener noreferrer">Source</a>
          }
        </mat-card-actions>
      </mat-card>
      @if (ev()!.type === 'DistantFeedEvent' && api.signedIn()) {
        <div class="maintainer-panel">
          <button mat-flat-button type="button" (click)="ack()">Ack distant feed</button>
        </div>
      }
    }
  `,
})
export class EventPage {
  readonly api = inject(RadarApi);
  private readonly route = inject(ActivatedRoute);
  readonly ev = signal<PublicEvent | undefined>(undefined);
  readonly error = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.api
      .getEvent(id)
      .then((e) => this.ev.set(e))
      .catch(() => this.error.set('Event not found.'));
  }

  kindOf(e: PublicEvent): string {
    return kindLabel(e.type);
  }

  ack(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.ack(id);
    }
  }
}
