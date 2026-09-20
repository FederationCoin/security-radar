import { Component, Input } from '@angular/core';

export type MilestoneMark = { id: string; at: string; label: string };

@Component({
  selector: 'app-timeline',
  template: `
    @if (milestones.length === 0) {
      <p class="chart-empty">No milestones.</p>
    } @else {
      <svg
        class="timeline"
        role="img"
        aria-label="PQ clock milestones"
        [attr.viewBox]="'0 0 400 ' + (milestones.length * 36 + 16)"
      >
        <line class="spine" x1="16" y1="8" x2="16" [attr.y2]="milestones.length * 36" />
        @for (m of milestones; track m.id; let i = $index) {
          <circle class="dot" cx="16" [attr.cy]="i * 36 + 16" r="6" />
          <text class="when" x="32" [attr.y]="i * 36 + 12">{{ m.at }}</text>
          <text class="what" x="32" [attr.y]="i * 36 + 28">{{ m.label }}</text>
        }
      </svg>
    }
  `,
  styles: `
    .timeline {
      width: 100%;
      max-width: 32rem;
      height: auto;
    }
    .spine {
      stroke: #c9a85a;
      stroke-width: 2;
    }
    .dot {
      fill: #c9a85a;
    }
    .when,
    .what {
      fill: #e8e4d9;
      font-size: 12px;
    }
  `,
})
export class TimelineComponent {
  @Input({ required: true }) milestones: MilestoneMark[] = [];
}
