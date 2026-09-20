import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardActions } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { RadarApi } from '../radar.api';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCardActions,
    MatFormField,
    MatLabel,
    MatInput,
    MatButton,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Maintainer login</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Paste Electrum compact 64-hex or a Bearer envelope JSON. Stored in this tab only. No cookie session. Dummy MAIN unused.</p>
        <p>Do not probe signed GET routes to “check” the envelope; reuse is rejected.</p>
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Signature</mat-label>
            <textarea matInput formControlName="envelope" rows="8" placeholder="Bearer eyJ..."></textarea>
          </mat-form-field>
        </form>
      </mat-card-content>
      <mat-card-actions>
        <button mat-flat-button type="button" (click)="save()">Use signature</button>
        @if (api.signedIn()) {
          <button mat-button type="button" (click)="clear()">Clear</button>
        }
      </mat-card-actions>
    </mat-card>
  `,
})
export class LoginPage {
  readonly api = inject(RadarApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = new FormGroup({
    envelope: new FormControl('', { nonNullable: true }),
  });

  save(): void {
    const v = this.form.controls.envelope.value.trim();
    this.api.signature.set(v);
    if (!v) {
      this.api.toast.set('Signature cleared.');
      return;
    }
    this.api.toast.set('Signature stored in this tab only.');
    void this.router.navigateByUrl(this.safeReturn());
  }

  clear(): void {
    this.form.controls.envelope.setValue('');
    this.api.signature.set('');
    this.api.toast.set('Signature cleared.');
  }

  private safeReturn(): string {
    const raw = this.route.snapshot.queryParamMap.get('return') ?? '';
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login')) {
      return raw;
    }
    return '/';
  }
}
