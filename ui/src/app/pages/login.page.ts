import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardActions } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import { ApiBase, RadarApi } from '../radar.api';

type SignContext = {
  signingBlockHeight: number;
  signingBlockHash: string;
  issuedAt: string;
  message: string;
  payloadHash: string;
};

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
        <p>Sign this message in Sparrow with an Electrum compact signature. One signature covers maintainer actions for 30 minutes, or until the signed block is more than 48 behind the tip. Dummy MAIN unused.</p>
        @if (loadError()) {
          <p class="toast">{{ loadError() }}</p>
        }
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Message to sign</mat-label>
            <textarea matInput formControlName="message" rows="6" readonly></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Wallet</mat-label>
            <input matInput formControlName="wallet" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Signature</mat-label>
            <textarea matInput formControlName="signature" rows="4"></textarea>
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
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly loadError = signal('');
  private context: SignContext | undefined;
  readonly form = new FormGroup({
    message: new FormControl('', { nonNullable: true }),
    wallet: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    signature: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.context = await firstValueFrom(
        this.http.get<SignContext>(`${ApiBase}/sign-context`, {
          headers: { 'X-FederationCoin-Chain': 'testnet' },
        }),
      );
      this.form.controls.message.setValue(this.context.message);
    } catch {
      this.loadError.set('Could not load the current block to sign.');
    }
  }

  save(): void {
    const signature = this.form.controls.signature.value.trim();
    const wallet = this.form.controls.wallet.value.trim();
    if (!signature || !wallet || !this.context) {
      this.api.signature.set('');
      this.api.toast.set('Signature cleared.');
      return;
    }
    const env = {
      messageVersion: 1,
      chain: 'testnet',
      wallet,
      payloadHash: this.context.payloadHash,
      signature,
      signingBlockHash: this.context.signingBlockHash,
      signingBlockHeight: this.context.signingBlockHeight,
      issuedAt: this.context.issuedAt,
    };
    const bearer = `Bearer ${btoa(JSON.stringify(env)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    this.api.signature.set(bearer);
    this.api.toast.set('Signature stored in this tab only.');
    void this.router.navigateByUrl(this.safeReturn());
  }

  clear(): void {
    this.form.controls.signature.setValue('');
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
