import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryActivityStore,
  type ActivityEvent,
  type Annotation,
  type SyncSettings,
} from '@timetracker/core';
import { executeDesktopSyncGate } from '../src/lib/sync-gate.js';
import {
  LocalStorageActivityEventRepository,
  LocalStorageAnnotationRepository,
  runDesktopStorageMigrations,
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
}

function createStore(storage: BrowserStorage): InMemoryActivityStore {
  return new InMemoryActivityStore({
    eventRepository: new LocalStorageActivityEventRepository(storage),
    annotationRepository: new LocalStorageAnnotationRepository(storage),
  });
}

function event(input: {
  eventId: string;
  resourceKey: string;
  startedAt: number;
  endedAt: number;
  source?: ActivityEvent['source'];
}): ActivityEvent {
  return {
    eventId: input.eventId,
    deviceId: 'desktop-offline-gate',
    resourceKind: 'project',
    resourceKey: input.resourceKey,
    resourceTitle: 'timetracker',
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    source: input.source ?? 'manual',
  };
}

function annotation(category: string, updatedAt: number): Annotation {
  return {
    primaryCategory: category,
    tags: ['offline'],
    updatedAt,
    updatedByDeviceId: 'desktop-offline-gate',
  };
}

function disabledSyncSettings(): SyncSettings {
  return {
    enabled: false,
    accountId: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'auto',
    syncIntervalMinutes: 5,
  };
}

test('offline beta gate: record + annotate + summarize + restart + sync-disabled short-circuit', async () => {
  const storage = new MemoryStorage();
  runDesktopStorageMigrations(storage);

  const store = createStore(storage);
  const base = Date.parse('2026-03-27T09:00:00.000Z');

  store.appendEvents([
    event({
      eventId: 'offline-a',
      resourceKey: '/workspace/timetracker',
      startedAt: base,
      endedAt: base + 60 * 60 * 1000,
    }),
    event({
      eventId: 'offline-b',
      resourceKey: '/workspace/timetracker',
      startedAt: base + 30 * 60 * 1000,
      endedAt: base + 90 * 60 * 1000,
      source: 'auto',
    }),
  ]);

  store.upsertAnnotation('offline-a', annotation('work', 1));
  store.upsertAnnotation('offline-b', annotation('work', 2));

  const summary = store.summarizeDay('2026-03-27');
  assert.equal(summary.byPrimaryCategory[0]?.key, 'work');
  assert.equal(summary.stackedMs, 2 * 60 * 60 * 1000);
  assert.equal(summary.naturalMs, 90 * 60 * 1000);

  let syncInvoked = 0;
  const syncResult = await executeDesktopSyncGate({
    settings: disabledSyncSettings(),
    day: '2026-03-27',
    deviceId: 'desktop-offline-gate',
    dayEvents: store.listEventsForDay('2026-03-27'),
    runSync: async () => {
      syncInvoked += 1;
      return {
        mergedEvents: [],
        objectsRead: 0,
      };
    },
  });

  assert.equal(syncResult.skipped, true);
  assert.equal(syncResult.message, 'sync disabled');
  assert.equal(syncResult.mergedEvents.length, 0);
  assert.equal(syncInvoked, 0);

  const reopened = createStore(storage);
  const reopenedSummary = reopened.summarizeDay('2026-03-27');
  assert.equal(reopened.listEventsForDay('2026-03-27').length, 2);
  assert.equal(reopenedSummary.stackedMs, summary.stackedMs);
  assert.equal(reopenedSummary.naturalMs, summary.naturalMs);
  assert.equal(reopenedSummary.byPrimaryCategory[0]?.key, 'work');
});
