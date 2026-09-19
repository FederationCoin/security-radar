import { Component, inject, signal } from '@angular/core';
import { RadarApi } from '../radar.api';

@Component({
  selector: 'app-tasks',
  template: `
    <h1>Tasks</h1>
    <p>Complete does not clear a vuln flag.</p>
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (tasks().length === 0 && !error()) {
      <p>No tasks.</p>
    }
    <ul>
      @for (t of tasks(); track t.id) {
        <li>{{ t.title }} {{ t.complete ? '(done)' : '' }}</li>
      }
    </ul>
  `,
})
export class TasksPage {
  private readonly api = inject(RadarApi);
  readonly tasks = signal<Array<{ id: string; title: string; complete: boolean }>>([]);
  readonly error = signal('');
  constructor() {
    void this.api
      .listTasks()
      .then((items) => this.tasks.set(items))
      .catch(() => this.error.set('Could not load tasks.'));
  }
}
