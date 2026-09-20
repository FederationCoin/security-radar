import { Component, Input } from '@angular/core';
import type { CountRow } from './kind-label';

@Component({
  selector: 'app-count-bars',
  template: `
    @if (rows.length === 0) {
      <p class="chart-empty">No counts yet.</p>
    } @else {
      <svg
        class="count-bars"
        role="img"
        [attr.aria-label]="caption || 'Counts'"
        [attr.viewBox]="'0 0 400 ' + (rows.length * 28 + 8)"
      >
        @for (row of rows; track row.label; let i = $index) {
          <text class="bar-label" x="0" [attr.y]="i * 28 + 16">{{ row.label }}</text>
          <rect
            class="bar"
            x="160"
            [attr.y]="i * 28 + 4"
            [attr.width]="barWidth(row.count)"
            height="16"
          />
          <text class="bar-count" [attr.x]="168 + barWidth(row.count)" [attr.y]="i * 28 + 16">
            {{ row.count }}
          </text>
        }
      </svg>
    }
  `,
  styles: `
    .count-bars {
      width: 100%;
      max-width: 32rem;
      height: auto;
    }
    .bar-label,
    .bar-count {
      fill: #e8e4d9;
      font-size: 12px;
    }
    .bar {
      fill: #c9a85a;
    }
    .chart-empty {
      color: #e8e4d9;
    }
  `,
})
export class CountBarsComponent {
  @Input({ required: true }) rows: CountRow[] = [];
  @Input() caption = '';

  barWidth(count: number): number {
    const max = Math.max(1, ...this.rows.map((r) => r.count));
    return (count / max) * 200;
  }
}
