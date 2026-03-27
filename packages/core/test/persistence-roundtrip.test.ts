import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RepositoryBackedActivityStore,
  type ActivityEvent,
  type ActivityEventRepository,
  type Annotation,
  type AnnotationRepository,
} from '../src/index.js';

interface SnapshotState {
  events: ActivityEvent[];
  annotations: Map<string, Annotation>;
}

class SnapshotEventRepository implements ActivityEventRepository {
  constructor(private readonly state: SnapshotState) {}

  readAll(): ActivityEvent[] {
    return [...this.state.events];
  }

  replaceAll(events: ActivityEvent[]): void {
    this.state.events = [...events];
  }
}

class SnapshotAnnotationRepository implements AnnotationRepository {
  constructor(private readonly state: SnapshotState) {}

  readAll(): ReadonlyMap<string, Annotation> {
    return this.state.annotations;
  }

  upsert(eventId: string, annotation: Annotation): Annotation {
    this.state.annotations.set(eventId, annotation);
    return annotation;
  }

  replaceAll(annotations: ReadonlyMap<string, Annotation>): void {
    this.state.annotations = new Map(annotations.entries());
  }
}

function createStore(state: SnapshotState): RepositoryBackedActivityStore {
  return new RepositoryBackedActivityStore({
    eventRepository: new SnapshotEventRepository(state),
    annotationRepository: new SnapshotAnnotationRepository(state),
  });
}

function createEvent(params: {
  eventId: string;
  start: number;
  end: number;
  deviceId?: string;
  resourceKey?: string;
}): ActivityEvent {
  return {
    eventId: params.eventId,
    deviceId: params.deviceId ?? 'desktop-a',
    resourceKind: 'project',
    resourceKey: params.resourceKey ?? '/workspace/timetracker',
    resourceTitle: 'timetracker',
    startedAt: params.start,
    endedAt: params.end,
    source: 'auto',
  };
}

test('append + idempotent merge keeps persisted event set across restart', () => {
  const snapshot: SnapshotState = {
    events: [],
    annotations: new Map(),
  };
  const store = createStore(snapshot);
  const base = Date.parse('2026-03-27T08:00:00.000Z');

  const good = createEvent({
    eventId: 'evt-1',
    start: base,
    end: base + 15 * 60 * 1000,
  });
  const duplicate = { ...good };
  const invalid = createEvent({
    eventId: 'evt-invalid',
    start: base + 20 * 60 * 1000,
    end: base + 20 * 60 * 1000,
  });

  const appendResult = store.appendEvents([good, duplicate, invalid]);
  assert.deepEqual(appendResult, { added: 1, duplicates: 1, invalid: 1 });

  const reloaded = createStore(snapshot);
  const events = reloaded.getAllEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventId, 'evt-1');
});

test('annotation LWW conflict resolution survives reload', () => {
  const snapshot: SnapshotState = {
    events: [],
    annotations: new Map(),
  };
  const store = createStore(snapshot);
  const base = Date.parse('2026-03-27T10:00:00.000Z');
  const event = createEvent({
    eventId: 'evt-lww',
    start: base,
    end: base + 10 * 60 * 1000,
  });
  store.appendEvents([event]);

  store.upsertAnnotation(event.eventId, {
    primaryCategory: 'work',
    tags: ['coding'],
    updatedAt: 100,
    updatedByDeviceId: 'desktop-a',
  });

  store.mergeRemoteAnnotations(
    new Map([
      [
        event.eventId,
        {
          primaryCategory: 'learning',
          tags: ['reading'],
          updatedAt: 100,
          updatedByDeviceId: 'mobile-z',
        },
      ],
    ]),
  );

  const reloaded = createStore(snapshot);
  const annotationAfterTieBreak = reloaded.getAnnotations().get(event.eventId);
  assert.equal(annotationAfterTieBreak?.primaryCategory, 'learning');
  assert.deepEqual(annotationAfterTieBreak?.tags, ['reading']);

  reloaded.mergeRemoteAnnotations(
    new Map([
      [
        event.eventId,
        {
          primaryCategory: 'older-update',
          tags: ['stale'],
          updatedAt: 99,
          updatedByDeviceId: 'mobile-y',
        },
      ],
    ]),
  );

  const afterOlderUpdate = reloaded.getAnnotations().get(event.eventId);
  assert.equal(afterOlderUpdate?.primaryCategory, 'learning');

  reloaded.upsertAnnotation(event.eventId, {
    primaryCategory: 'focus',
    tags: ['deep-work'],
    updatedAt: 101,
    updatedByDeviceId: 'desktop-a',
  });

  const finalReload = createStore(snapshot);
  const finalAnnotation = finalReload.getAnnotations().get(event.eventId);
  assert.equal(finalAnnotation?.primaryCategory, 'focus');
  assert.deepEqual(finalAnnotation?.tags, ['deep-work']);
});

test('day query and summary remain consistent after restart-like reload', () => {
  const snapshot: SnapshotState = {
    events: [],
    annotations: new Map(),
  };
  const store = createStore(snapshot);
  const day = '2026-03-27';
  const base = Date.parse(`${day}T09:00:00.000Z`);

  const eventA = createEvent({
    eventId: 'evt-day-a',
    start: base,
    end: base + 60 * 60 * 1000,
    resourceKey: '/workspace/proj-a',
  });
  const eventB = createEvent({
    eventId: 'evt-day-b',
    start: base + 30 * 60 * 1000,
    end: base + 90 * 60 * 1000,
    resourceKey: '/workspace/proj-b',
  });
  const eventOtherDay = createEvent({
    eventId: 'evt-other-day',
    start: Date.parse('2026-03-28T09:00:00.000Z'),
    end: Date.parse('2026-03-28T10:00:00.000Z'),
  });

  store.appendEvents([eventA, eventB, eventOtherDay]);

  store.upsertAnnotation(eventA.eventId, {
    primaryCategory: 'work',
    tags: ['proj-a'],
    updatedAt: 1,
    updatedByDeviceId: 'desktop-a',
  });
  store.upsertAnnotation(eventB.eventId, {
    primaryCategory: 'work',
    tags: ['proj-b'],
    updatedAt: 2,
    updatedByDeviceId: 'desktop-a',
  });

  const before = store.summarizeDay(day);
  const reloaded = createStore(snapshot);
  const dayEvents = reloaded.listEventsForDay(day);
  const after = reloaded.summarizeDay(day);

  assert.equal(dayEvents.length, 2);
  assert.equal(dayEvents[0]?.eventId, 'evt-day-a');
  assert.equal(dayEvents[1]?.eventId, 'evt-day-b');
  assert.equal(after.naturalMs, before.naturalMs);
  assert.equal(after.stackedMs, before.stackedMs);
  assert.equal(after.byPrimaryCategory[0]?.key, 'work');
});
