import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { RadarApi, type Bip } from '../radar.api';
import { bipMediawikiUrl } from '../kind-label';

@Component({
  selector: 'app-bips',
  imports: [
    ReactiveFormsModule,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCardActions,
    MatAnchor,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatCheckbox,
  ],
  template: `
    <h1>BIPs</h1>
    @if (loading()) {
      <p>Loading…</p>
    }
    @if (!loading() && error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (!loading() && bips().length === 0 && !error()) {
      <p>No BIPs.</p>
    }
    <div class="card-grid">
      @for (b of bips(); track b.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>BIP {{ b.number }} — {{ b.title }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p>{{ b.summary }}</p>
            <h3>Understanding</h3>
            <p>{{ b.whatItDoes || 'No maintainer write-up yet.' }}</p>
            <h3>Applicability</h3>
            <p>{{ b.howItHitsUs || 'No maintainer write-up yet.' }}</p>
            @if (b.honorNotes) {
              <p>{{ b.honorNotes }}</p>
            }
            @if (b.ethosNotes) {
              <p>{{ b.ethosNotes }}</p>
            }
          </mat-card-content>
          <mat-card-actions>
            <a mat-button [href]="source(b.number)" target="_blank" rel="noopener noreferrer">BIP source</a>
          </mat-card-actions>
          @if (api.signedIn()) {
            <div class="maintainer-panel">
              <form [formGroup]="formFor(b.id)">
                <mat-form-field appearance="outline" class="full-field">
                  <mat-label>Understanding</mat-label>
                  <textarea matInput formControlName="understanding" rows="3"></textarea>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-field">
                  <mat-label>Applicability</mat-label>
                  <textarea matInput formControlName="applicability" rows="3"></textarea>
                </mat-form-field>
                <p>
                  <mat-checkbox formControlName="honor">Honor this BIP</mat-checkbox>
                  <mat-checkbox formControlName="implement">Implement on FederationCoin</mat-checkbox>
                </p>
                <button mat-flat-button type="button" (click)="submit(b.id)">Save review</button>
              </form>
            </div>
          }
        </mat-card>
      }
    </div>
  `,
})
export class BipsPage {
  readonly api = inject(RadarApi);
  readonly bips = signal<Bip[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  private readonly forms = new Map<string, FormGroup<{
    understanding: FormControl<string>;
    applicability: FormControl<string>;
    honor: FormControl<boolean>;
    implement: FormControl<boolean>;
  }>>();

  constructor() {
    void this.api
      .listBips()
      .then((items) => {
        this.bips.set(items);
        for (const b of items) {
          this.forms.set(
            b.id,
            new FormGroup({
              understanding: new FormControl(b.whatItDoes ?? '', {
                nonNullable: true,
                validators: [Validators.required],
              }),
              applicability: new FormControl(b.howItHitsUs ?? '', {
                nonNullable: true,
                validators: [Validators.required],
              }),
              honor: new FormControl(false, { nonNullable: true }),
              implement: new FormControl(false, { nonNullable: true }),
            }),
          );
        }
      })
      .catch(() => this.error.set('Could not load BIPs.'))
      .finally(() => this.loading.set(false));
  }

  source(n: number): string {
    return bipMediawikiUrl(n);
  }

  formFor(id: string) {
    return this.forms.get(id)!;
  }

  submit(bipId: string): void {
    const g = this.forms.get(bipId);
    if (!g) {
      return;
    }
    if (g.invalid) {
      g.markAllAsTouched();
      return;
    }
    const v = g.getRawValue();
    void this.api.reviewBip({
      bipId,
      understanding: v.understanding,
      applicability: v.applicability,
      honor: v.honor,
      implement: v.implement,
    });
  }
}
