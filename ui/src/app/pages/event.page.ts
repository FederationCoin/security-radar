import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RadarApi, type PublicEvent } from '../radar.api';

@Component({
  selector: 'app-event',
  template: `
    <h1>Event</h1>
    @if (error()) {
      <p class="toast">{{ error() }}</p>
    }
    @if (ev()) {
      <p>{{ ev()!.type }}</p>
      <p>{{ ev()!.summary || ev()!.title || ev()!.id }}</p>
      @if (ev()!.type === 'DistantFeedEvent') {
        <button type="button" (click)="ack()">Ack distant feed</button>
      }
    }
  `,
})
export class EventPage {
  private readonly api = inject(RadarApi);
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

  ack(): void {
    const id = this.ev()?.id;
    if (id) {
      void this.api.ack(id);
    }
  }
}
