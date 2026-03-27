import type { Annotation, ActivityEvent } from './types.js';

export interface ActivityEventRepository {
  readAll(): ActivityEvent[];
  replaceAll(events: ActivityEvent[]): void;
}

export interface AnnotationRepository {
  readAll(): ReadonlyMap<string, Annotation>;
  upsert(eventId: string, annotation: Annotation): Annotation;
  replaceAll(annotations: ReadonlyMap<string, Annotation>): void;
}

export class InMemoryActivityEventRepository implements ActivityEventRepository {
  private readonly events = new Map<string, ActivityEvent>();

  readAll(): ActivityEvent[] {
    return [...this.events.values()];
  }

  replaceAll(events: ActivityEvent[]): void {
    this.events.clear();

    for (const event of events) {
      this.events.set(event.eventId, event);
    }
  }
}

export class InMemoryAnnotationRepository implements AnnotationRepository {
  private readonly annotations = new Map<string, Annotation>();

  readAll(): ReadonlyMap<string, Annotation> {
    return this.annotations;
  }

  upsert(eventId: string, annotation: Annotation): Annotation {
    this.annotations.set(eventId, annotation);
    return annotation;
  }

  replaceAll(annotations: ReadonlyMap<string, Annotation>): void {
    this.annotations.clear();

    for (const [eventId, annotation] of annotations.entries()) {
      this.annotations.set(eventId, annotation);
    }
  }
}
