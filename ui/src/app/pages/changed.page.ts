import { Component } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';

@Component({
  selector: 'app-changed',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>What we changed</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>
          Assessments and fork write-ups land in a later epic. This tab is the public place they will
          appear. It is not a ThreatEvent and not a third hostname. Copy lands with epic 7.
        </p>
      </mat-card-content>
    </mat-card>
  `,
})
export class ChangedPage {}
