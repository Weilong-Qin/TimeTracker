import { mergeAnnotations, resolveLww } from './annotation.js';
import { mergeEventBatches } from './event-log.js';
import { summarizeDaily, type DailySummary } from './classification.js';
import {
  InMemoryActivityEventRepository,
  InMemoryAnnotationRepository,
  type ActivityEventRepository,
  type AnnotationRepository,
} from './repository.js';
import type { ActivityEvent, Annotation } from './types.js';

export interface AppendEventsResult {
  added: number;
  duplicates: number;
  invalid: number;
}

export interface ActivityStore {
  appendEvents(events: ActivityEvent[]): AppendEventsResult;
  upsertAnnotation(eventId: string, annotation: Annotation): Annotation;
  mergeRemoteAnnotations(incoming: ReadonlyMap<string, Annotation>): void;
  listEventsForDay(day: string): ActivityEvent[];
  summarizeDay(day: string): DailySummary;
  getAnnotations(): ReadonlyMap<string, Annotation>;
  getAllEvents(): ActivityEvent[];
}

export interface ActivityStoreRepositories {
  eventRepository: ActivityEventRepository;
  annotationRepository: AnnotationRepository;
}

function dayToUtcRange(day: string): { start: number; end: number } {
  const start = Date.parse(`${day}T00:00:00.000Z`);
  const end = Date.parse(`${day}T23:59:59.999Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`Invalid day value: ${day}`);
  }

  return { start, end };
}

function sortEventsByTime(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => a.startedAt - b.startedAt);
}

export class RepositoryBackedActivityStore implements ActivityStore {
  private readonly eventRepository: ActivityEventRepository;

  private readonly annotationRepository: AnnotationRepository;

  constructor(repositories: ActivityStoreRepositories) {
    this.eventRepository = repositories.eventRepository;
    this.annotationRepository = repositories.annotationRepository;
  }

  appendEvents(events: ActivityEvent[]): AppendEventsResult {
    const current = this.eventRepository.readAll();
    const beforeCount = current.length;
    const merged = mergeEventBatches([current, events]);
    this.eventRepository.replaceAll(merged.merged);

    return {
      added: Math.max(0, merged.merged.length - beforeCount),
      duplicates: merged.duplicates,
      invalid: merged.invalid,
    };
  }

  upsertAnnotation(eventId: string, annotation: Annotation): Annotation {
    const current = this.annotationRepository.readAll().get(eventId);
    const selected = resolveLww(current, annotation);
    return this.annotationRepository.upsert(eventId, selected);
  }

  mergeRemoteAnnotations(incoming: ReadonlyMap<string, Annotation>): void {
    const merged = mergeAnnotations(this.annotationRepository.readAll(), incoming);
    this.annotationRepository.replaceAll(merged);
  }

  listEventsForDay(day: string): ActivityEvent[] {
    const { start, end } = dayToUtcRange(day);

    return this.eventRepository
      .readAll()
      .filter((event) => event.startedAt <= end && event.endedAt >= start)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  summarizeDay(day: string): DailySummary {
    return summarizeDaily(this.listEventsForDay(day), this.annotationRepository.readAll());
  }

  getAnnotations(): ReadonlyMap<string, Annotation> {
    return this.annotationRepository.readAll();
  }

  getAllEvents(): ActivityEvent[] {
    return sortEventsByTime(this.eventRepository.readAll());
  }
}

export class InMemoryActivityStore extends RepositoryBackedActivityStore {
  constructor(repositories?: Partial<ActivityStoreRepositories>) {
    super({
      eventRepository: repositories?.eventRepository ?? new InMemoryActivityEventRepository(),
      annotationRepository:
        repositories?.annotationRepository ?? new InMemoryAnnotationRepository(),
    });
  }
}
