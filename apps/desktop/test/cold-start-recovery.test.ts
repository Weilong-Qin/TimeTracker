import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryActivityStore,
  type ActivityEvent,
  type Annotation,
} from '@timetracker/core';
import {
  DESKTOP_STORAGE_KEYS,
  LocalStorageActivityEventRepository,
  LocalStorageAnnotationRepository,
  readStoredValue,
  runDesktopStorageMigrations,
  writeStoredValue,
  type BrowserStorage,
} from '../src/storage/persistence.js';

class MemoryStorage implements BrowserStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  keys(): string[] {
    return [...this.values.keys()];
  }
}

function createStore(storage: BrowserStorage): InMemoryActivityStore {
  return new InMemoryActivityStore({
    eventRepository: new LocalStorageActivityEventRepository(storage),
    annotationRepository: new LocalStorageAnnotationRepository(storage),
  });
}

function createEvent(params: {
  eventId: string;
  startedAt: number;
  endedAt: number;
}): ActivityEvent {
  return {
    eventId: params.eventId,
    deviceId: 'desktop-cold-start',
    resourceKind: 'project',
    resourceKey: '/workspace/timetracker',
    resourceTitle: 'timetracker',
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    source: 'auto',
  };
}

function createAnnotation(params: {
  category: string;
  updatedAt: number;
}): Annotation {
  return {
    primaryCategory: params.category,
    tags: ['focus'],
    updatedAt: params.updatedAt,
    updatedByDeviceId: 'desktop-cold-start',
  };
}

test('cold-start check: record -> close -> reopen -> verify keeps timeline and aggregates', () => {
  const storage = new MemoryStorage();
  runDesktopStorageMigrations(storage);

  const store = createStore(storage);
  const base = Date.parse('2026-03-27T09:00:00.000Z');

  const eventA = createEvent({
    eventId: 'cold-start-a',
    startedAt: base,
    endedAt: base + 60 * 60 * 1000,
  });
  const eventB = createEvent({
    eventId: 'cold-start-b',
    startedAt: base + 30 * 60 * 1000,
    endedAt: base + 90 * 60 * 1000,
  });

  store.appendEvents([eventA, eventB]);
  store.upsertAnnotation(eventA.eventId, createAnnotation({ category: 'work', updatedAt: 1 }));
  store.upsertAnnotation(eventB.eventId, createAnnotation({ category: 'work', updatedAt: 2 }));

  writeStoredValue(
    storage,
    DESKTOP_STORAGE_KEYS.syncSettings,
    JSON.stringify({
      enabled: true,
      accountId: 'acc',
      bucket: 'bucket',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      region: 'auto',
      syncIntervalMinutes: 5,
    }),
  );

  const beforeSummary = store.summarizeDay('2026-03-27');

  const reopened = createStore(storage);
  const reopenedEvents = reopened.listEventsForDay('2026-03-27');
  const reopenedSummary = reopened.summarizeDay('2026-03-27');
  const savedSettings = readStoredValue(storage, DESKTOP_STORAGE_KEYS.syncSettings);

  assert.equal(reopenedEvents.length, 2);
  assert.equal(reopenedEvents[0]?.eventId, 'cold-start-a');
  assert.equal(reopenedEvents[1]?.eventId, 'cold-start-b');
  assert.equal(reopenedSummary.naturalMs, beforeSummary.naturalMs);
  assert.equal(reopenedSummary.stackedMs, beforeSummary.stackedMs);
  assert.equal(reopenedSummary.byPrimaryCategory[0]?.key, 'work');
  assert.equal(typeof savedSettings, 'string');
  assert.equal(
    JSON.parse(savedSettings ?? '{}').syncIntervalMinutes,
    5,
  );
});

test('cold-start degraded check: corrupted payloads are quarantined and store remains operable', () => {
  const storage = new MemoryStorage();

  storage.setItem(DESKTOP_STORAGE_KEYS.events, 'corrupted-json');
  storage.setItem(DESKTOP_STORAGE_KEYS.annotations, '{"broken":');
  storage.setItem('timetracker.desktop.storage.meta', '{"schemaVersion":"oops"}');

  const report = runDesktopStorageMigrations(storage);
  assert.equal(report.toVersion, 1);

  const coldStarted = createStore(storage);
  assert.equal(coldStarted.getAllEvents().length, 0);
  assert.equal(coldStarted.getAnnotations().size, 0);

  const keys = storage.keys();
  assert.ok(keys.some((key) => key.startsWith(`${DESKTOP_STORAGE_KEYS.events}.corrupt.`)));
  assert.ok(keys.some((key) => key.startsWith(`${DESKTOP_STORAGE_KEYS.annotations}.corrupt.`)));
  assert.ok(keys.some((key) => key.startsWith('timetracker.desktop.storage.meta.corrupt.')));

  const recoveredEvent = createEvent({
    eventId: 'recovered-event',
    startedAt: Date.parse('2026-03-27T13:00:00.000Z'),
    endedAt: Date.parse('2026-03-27T13:30:00.000Z'),
  });

  coldStarted.appendEvents([recoveredEvent]);
  coldStarted.upsertAnnotation(
    recoveredEvent.eventId,
    createAnnotation({ category: 'recovered', updatedAt: 10 }),
  );

  const reopenedAfterRecovery = createStore(storage);
  assert.equal(reopenedAfterRecovery.getAllEvents().length, 1);
  assert.equal(
    reopenedAfterRecovery.getAnnotations().get('recovered-event')?.primaryCategory,
    'recovered',
  );
});
