import { Component, inject, signal } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { RadarApi, type RadarTask } from '../radar.api';
import { CountBarsComponent } from '../count-bars';
import { taskCounts } from '../kind-label';

@Component({
  selector: 'app-tasks',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatButton, CountBarsComponent],
  template: `
    <h1>Tasks</h1>
    <p>Complete does not clear a vuln flag.</p>
    @if (loading()) {
      <p>Loading…</p>
    }
    @if (!loading() && error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (!loading() && tasks().length === 0 && !error()) {
      <p>No tasks.</p>
    }
    @if (!loading() && !error()) {
      <app-count-bars [rows]="counts()" caption="Open versus done" />
    }
    <div class="card-grid">
      @for (t of tasks(); track t.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ t.title }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (t.complete) {
              <p>Done</p>
            } @else {
              @if (t.accepted) {
                <p>Accepted</p>
              }
              @if (api.signedIn()) {
                <div class="maintainer-panel">
                  @if (!t.accepted) {
                    <button mat-button type="button" (click)="accept(t.id)">Accept</button>
                  }
                  <button mat-flat-button type="button" (click)="complete(t.id)">Complete</button>
                </div>
              }
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
})
export class TasksPage {
  readonly api = inject(RadarApi);
  readonly tasks = signal<RadarTask[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    void this.reload();
  }

  counts() {
    return taskCounts(this.tasks());
  }

  accept(taskId: string): void {
    void this.api.acceptTask(taskId).then(() => this.reload());
  }

  complete(taskId: string): void {
    void this.api.completeTask(taskId).then(() => this.reload());
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.tasks.set(await this.api.listTasks());
    } catch {
      this.error.set('Could not load tasks.');
    } finally {
      this.loading.set(false);
    }
  }
}
