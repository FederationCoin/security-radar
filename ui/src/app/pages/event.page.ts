import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RadarApi, type PublicEvent } from '../radar.api';
import { kindLabel } from '../kind-label';

@Component({
  selector: 'app-event',
  imports: [
    ReactiveFormsModule,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatCardContent,
    MatCardActions,
    MatButton,
    MatAnchor,
    MatFormField,
    MatLabel,
    MatInput,
  ],
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
      @if (ev()!.type === 'UpstreamMainlineEvent' && api.signedIn()) {
        <div class="maintainer-panel">
          <form [formGroup]="human">
            <mat-form-field appearance="outline" class="full-field">
              <mat-label>Human assessment</mat-label>
              <textarea matInput formControlName="writeup" rows="3"></textarea>
            </mat-form-field>
            <button mat-flat-button type="button" (click)="saveHuman()">Save human assessment</button>
          </form>
          <form [formGroup]="noFork">
            <mat-form-field appearance="outline" class="full-field">
              <mat-label>No fork</mat-label>
              <textarea matInput formControlName="writeup" rows="3"></textarea>
            </mat-form-field>
            <button mat-button type="button" (click)="saveNoFork()">Save no-fork assessment</button>
          </form>
          <form [formGroup]="softFork">
            <mat-form-field appearance="outline" class="full-field">
              <mat-label>Soft fork</mat-label>
              <textarea matInput formControlName="writeup" rows="3"></textarea>
            </mat-form-field>
            <button mat-button type="button" (click)="saveSoftFork()">Save soft-fork assessment</button>
          </form>
          <form [formGroup]="hardFork">
            <mat-form-field appearance="outline" class="full-field">
              <mat-label>Hard fork</mat-label>
              <textarea matInput formControlName="writeup" rows="3"></textarea>
            </mat-form-field>
            <button mat-button type="button" (click)="saveHardFork()">Save hard-fork assessment</button>
          </form>
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
  readonly human = new FormGroup({ writeup: new FormControl('', { nonNullable: true }) });
  readonly noFork = new FormGroup({ writeup: new FormControl('', { nonNullable: true }) });
  readonly softFork = new FormGroup({ writeup: new FormControl('', { nonNullable: true }) });
  readonly hardFork = new FormGroup({ writeup: new FormControl('', { nonNullable: true }) });

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

  saveHuman(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.recordHuman(id, this.human.controls.writeup.value);
    }
  }

  saveNoFork(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.recordNoFork(id, this.noFork.controls.writeup.value);
    }
  }

  saveSoftFork(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.recordSoftFork(id, this.softFork.controls.writeup.value);
    }
  }

  saveHardFork(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.recordHardFork(id, this.hardFork.controls.writeup.value);
    }
  }
}
