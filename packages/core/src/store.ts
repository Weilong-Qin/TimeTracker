import { mergeAnnotations, resolveLww } from './annotation.js';
import { mergeEventBatches } from './event-log.js';
import { summarizeDaily, type DailySummary } from './classification.js';
import type { ActivityEvent, Annotation } from './types.js';

export interface AppendEventsResult {
  added: number;
  duplicates: number;
  invalid: number;
}

function dayToUtcRange(day: string): { start: number; end: number } {
  const start = Date.parse(`${day}T00:00:00.000Z`);
  const end = Date.parse(`${day}T23:59:59.999Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`Invalid day value: ${day}`);
  }

  return { start, end };
}

export class InMemoryActivityStore {
  private readonly events = new Map<string, ActivityEvent>();

  private readonly annotations = new Map<string, Annotation>();

  appendEvents(events: ActivityEvent[]): AppendEventsResult {
    const beforeCount = this.events.size;
    const merged = mergeEventBatches([[...this.events.values()], events]);

    this.events.clear();
    for (const event of merged.merged) {
      this.events.set(event.eventId, event);
    }

    return {
      added: Math.max(0, merged.merged.length - beforeCount),
      duplicates: merged.duplicates,
      invalid: merged.invalid,
    };
  }

  upsertAnnotation(eventId: string, annotation: Annotation): Annotation {
    const selected = resolveLww(this.annotations.get(eventId), annotation);
    this.annotations.set(eventId, selected);
    return selected;
  }

  mergeRemoteAnnotations(incoming: ReadonlyMap<string, Annotation>): void {
    const merged = mergeAnnotations(this.annotations, incoming);
    this.annotations.clear();
    for (const [eventId, annotation] of merged.entries()) {
      this.annotations.set(eventId, annotation);
    }
  }

  listEventsForDay(day: string): ActivityEvent[] {
    const { start, end } = dayToUtcRange(day);

    return [...this.events.values()]
      .filter((event) => event.startedAt <= end && event.endedAt >= start)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  summarizeDay(day: string): DailySummary {
    return summarizeDaily(this.listEventsForDay(day), this.annotations);
  }

  getAnnotations(): ReadonlyMap<string, Annotation> {
    return this.annotations;
  }

  getAllEvents(): ActivityEvent[] {
    return [...this.events.values()].sort((a, b) => a.startedAt - b.startedAt);
  }
}
