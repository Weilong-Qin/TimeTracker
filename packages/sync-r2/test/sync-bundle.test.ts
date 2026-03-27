import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  InMemoryActivityStore,
  type ActivityEvent,
  type Annotation,
  type SyncSettings,
} from '@timetracker/core';
import {
  buildDailyDeviceAnnotationsObjectKey,
  buildDailyDeviceReportsObjectKey,
  syncDay,
  syncDayBundle,
  syncDayBundleWithRetry,
  type SyncExecutionOptions,
  type SyncReportArtifact,
} from '../src/index.js';

class FakeR2Client {
  private readonly objects = new Map<string, string>();
  private readonly putObjectKeys: string[] = [];

  keys(): string[] {
    return [...this.objects.keys()].sort();
  }

  putKeys(): string[] {
    return [...this.putObjectKeys];
  }

  putRaw(key: string, payload: string): void {
    this.objects.set(key, payload);
  }

  getRaw(key: string): string | undefined {
    return this.objects.get(key);
  }

  async send(command: unknown): Promise<unknown> {
    if (command instanceof PutObjectCommand) {
      const key = String(command.input.Key ?? '');
      const body = command.input.Body;
      if (typeof body !== 'string') {
        throw new Error('FakeR2Client only supports string bodies');
      }

      this.objects.set(key, body);
      this.putObjectKeys.push(key);
      return {};
    }

    if (command instanceof ListObjectsV2Command) {
      const prefix = String(command.input.Prefix ?? '');
      const keys = this.keys().filter((key) => key.startsWith(prefix));
      return {
        Contents: keys.map((key) => ({ Key: key })),
        IsTruncated: false,
      };
    }

    if (command instanceof GetObjectCommand) {
      const key = String(command.input.Key ?? '');
      const payload = this.objects.get(key);
      if (payload === undefined) {
        throw new Error(`object not found: ${key}`);
      }

      return {
        Body: {
          async transformToString() {
            return payload;
          },
        },
      };
    }

    throw new Error('unsupported command type for FakeR2Client');
  }
}

class FlakyR2Client extends FakeR2Client {
  private failed = 0;

  constructor(private readonly failuresBeforeSuccess: number) {
    super();
  }

  override async send(command: unknown): Promise<unknown> {
    if (this.failed < this.failuresBeforeSuccess) {
      this.failed += 1;
      throw new Error(`transient sync failure #${this.failed}`);
    }

    return super.send(command);
  }
}

function createSyncSettings(): SyncSettings {
  return {
    enabled: true,
    accountId: 'acct',
    bucket: 'timetracker-sync',
    accessKeyId: 'ak',
    secretAccessKey: 'sk',
    region: 'auto',
    syncIntervalMinutes: 5,
  };
}

function createEvent(input: {
  eventId: string;
  deviceId: string;
  startedAt: number;
  endedAt: number;
}): ActivityEvent {
  return {
    eventId: input.eventId,
    deviceId: input.deviceId,
    resourceKind: 'project',
    resourceKey: '/workspace/timetracker',
    resourceTitle: 'timetracker',
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    source: 'auto',
  };
}

function createAnnotation(input: {
  category: string;
  updatedAt: number;
  updatedByDeviceId: string;
}): Annotation {
  return {
    primaryCategory: input.category,
    tags: ['focus'],
    updatedAt: input.updatedAt,
    updatedByDeviceId: input.updatedByDeviceId,
  };
}

function createReport(input: {
  periodKey: string;
  updatedAt: number;
  updatedByDeviceId: string;
  content: string;
}): SyncReportArtifact {
  return {
    periodType: 'daily',
    periodKey: input.periodKey,
    generatedAt: input.updatedAt,
    updatedAt: input.updatedAt,
    updatedByDeviceId: input.updatedByDeviceId,
    source: 'manual',
    content: input.content,
  };
}

interface DeviceState {
  allEvents: ActivityEvent[];
  annotations: Map<string, Annotation>;
  reports: Map<string, SyncReportArtifact>;
}

function cloneState(state: DeviceState): DeviceState {
  return {
    allEvents: [...state.allEvents],
    annotations: new Map(state.annotations),
    reports: new Map(state.reports),
  };
}

function canonicalizeState(state: DeviceState): {
  events: string[];
  annotations: Array<{ eventId: string; category: string; updatedAt: number; updatedByDeviceId: string }>;
  reports: Array<{ reportId: string; content: string; updatedAt: number; updatedByDeviceId: string }>;
} {
  return {
    events: [...state.allEvents].map((event) => event.eventId).sort(),
    annotations: [...state.annotations.entries()]
      .map(([eventId, annotation]) => ({
        eventId,
        category: annotation.primaryCategory ?? '',
        updatedAt: annotation.updatedAt,
        updatedByDeviceId: annotation.updatedByDeviceId,
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
    reports: [...state.reports.entries()]
      .map(([reportId, report]) => ({
        reportId,
        content: report.content,
        updatedAt: report.updatedAt,
        updatedByDeviceId: report.updatedByDeviceId,
      }))
      .sort((a, b) => a.reportId.localeCompare(b.reportId)),
  };
}

function summarizeDayFromState(day: string, state: DeviceState): { stackedMs: number; naturalMs: number } {
  const store = new InMemoryActivityStore();
  store.appendEvents(state.allEvents);
  store.mergeRemoteAnnotations(state.annotations);
  const summary = store.summarizeDay(day);
  return {
    stackedMs: summary.stackedMs,
    naturalMs: summary.naturalMs,
  };
}

function summaryGapMs(day: string, a: DeviceState, b: DeviceState): { stackedGapMs: number; naturalGapMs: number } {
  const left = summarizeDayFromState(day, a);
  const right = summarizeDayFromState(day, b);
  return {
    stackedGapMs: Math.abs(left.stackedMs - right.stackedMs),
    naturalGapMs: Math.abs(left.naturalMs - right.naturalMs),
  };
}

async function syncRound(params: {
  settings: SyncSettings;
  day: string;
  deviceId: string;
  state: DeviceState;
  options: SyncExecutionOptions;
}): Promise<DeviceState> {
  const result = await syncDayBundle(
    params.settings,
    params.day,
    params.deviceId,
    params.state.allEvents.filter((event) => event.deviceId === params.deviceId),
    params.state.annotations,
    params.state.reports,
    params.options,
  );

  return {
    allEvents: result.mergedEvents,
    annotations: new Map(result.mergedAnnotations),
    reports: new Map(result.mergedReports),
  };
}

test('syncDayBundle transfers and merges events + annotations + reports across devices', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  const deviceAEvents = [
    createEvent({
      eventId: 'event-a',
      deviceId: 'device-a',
      startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
      endedAt: Date.parse('2026-03-27T10:00:00.000Z'),
    }),
  ];
  const deviceAAnnotations = new Map<string, Annotation>([
    [
      'event-a',
      createAnnotation({
        category: 'work',
        updatedAt: 100,
        updatedByDeviceId: 'device-a',
      }),
    ],
  ]);
  const deviceAReports = new Map<string, SyncReportArtifact>([
    [
      `daily:${day}`,
      createReport({
        periodKey: day,
        updatedAt: 100,
        updatedByDeviceId: 'device-a',
        content: 'device-a report',
      }),
    ],
  ]);

  await syncDayBundle(
    settings,
    day,
    'device-a',
    deviceAEvents,
    deviceAAnnotations,
    deviceAReports,
    options,
  );

  const deviceBEvents = [
    createEvent({
      eventId: 'event-b',
      deviceId: 'device-b',
      startedAt: Date.parse('2026-03-27T11:00:00.000Z'),
      endedAt: Date.parse('2026-03-27T11:30:00.000Z'),
    }),
  ];
  const deviceBAnnotations = new Map<string, Annotation>([
    [
      'event-a',
      createAnnotation({
        category: 'learning',
        updatedAt: 200,
        updatedByDeviceId: 'device-b',
      }),
    ],
  ]);
  const deviceBReports = new Map<string, SyncReportArtifact>([
    [
      `daily:${day}`,
      createReport({
        periodKey: day,
        updatedAt: 250,
        updatedByDeviceId: 'device-b',
        content: 'device-b report',
      }),
    ],
  ]);

  const resultB = await syncDayBundle(
    settings,
    day,
    'device-b',
    deviceBEvents,
    deviceBAnnotations,
    deviceBReports,
    options,
  );

  assert.equal(resultB.mergedEvents.length, 2);
  assert.equal(resultB.mergedAnnotations.get('event-a')?.primaryCategory, 'learning');
  assert.equal(resultB.mergedReports.get(`daily:${day}`)?.content, 'device-b report');

  const resultA = await syncDayBundle(
    settings,
    day,
    'device-a',
    deviceAEvents,
    deviceAAnnotations,
    deviceAReports,
    options,
  );

  assert.equal(resultA.mergedEvents.length, 2);
  assert.equal(resultA.mergedAnnotations.get('event-a')?.primaryCategory, 'learning');
  assert.equal(resultA.mergedReports.get(`daily:${day}`)?.content, 'device-b report');
  assert.ok(resultA.annotationObjectsRead >= 2);
  assert.ok(resultA.reportObjectsRead >= 2);

  const keys = client.keys();
  assert.ok(keys.includes(buildDailyDeviceAnnotationsObjectKey(day, 'device-a')));
  assert.ok(keys.includes(buildDailyDeviceAnnotationsObjectKey(day, 'device-b')));
  assert.ok(keys.includes(buildDailyDeviceReportsObjectKey(day, 'device-a')));
  assert.ok(keys.includes(buildDailyDeviceReportsObjectKey(day, 'device-b')));
});

test('syncDay remains backward compatible when annotation/report objects exist', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  await syncDayBundle(
    settings,
    day,
    'device-a',
    [
      createEvent({
        eventId: 'event-compat',
        deviceId: 'device-a',
        startedAt: Date.parse('2026-03-27T10:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T10:30:00.000Z'),
      }),
    ],
    new Map([
      [
        'event-compat',
        createAnnotation({
          category: 'work',
          updatedAt: 10,
          updatedByDeviceId: 'device-a',
        }),
      ],
    ]),
    new Map([
      [
        `daily:${day}`,
        createReport({
          periodKey: day,
          updatedAt: 10,
          updatedByDeviceId: 'device-a',
          content: 'compat report',
        }),
      ],
    ]),
    options,
  );

  const legacyResult = await syncDay(settings, day, 'device-legacy', [], options);
  assert.equal(legacyResult.mergedEvents.length, 1);
  assert.equal(legacyResult.mergedEvents[0]?.eventId, 'event-compat');
});

test('syncDayBundle tolerates malformed annotation/report payload objects', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  client.putRaw(buildDailyDeviceAnnotationsObjectKey(day, 'bad-device'), '{"broken":');
  client.putRaw(buildDailyDeviceReportsObjectKey(day, 'bad-device'), '{"broken":');

  const result = await syncDayBundle(
    settings,
    day,
    'device-a',
    [],
    new Map(),
    new Map(),
    options,
  );

  assert.ok(result.invalidAnnotationObjects >= 1);
  assert.ok(result.invalidReportObjects >= 1);
});

test('syncDayBundleWithRetry retries transient failures with exponential backoff', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FlakyR2Client(2);
  const delays: number[] = [];

  const result = await syncDayBundleWithRetry(
    settings,
    day,
    'device-retry',
    [
      createEvent({
        eventId: 'event-retry',
        deviceId: 'device-retry',
        startedAt: Date.parse('2026-03-27T08:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T08:20:00.000Z'),
      }),
    ],
    new Map(),
    new Map(),
    {
      client,
      retry: {
        policy: {
          maxRetries: 3,
          baseDelayMs: 25,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    },
  );

  assert.equal(result.mergedEvents.length, 1);
  assert.deepEqual(delays, [25, 50]);
});

test('syncDayBundleWithRetry throws last error when retries are exhausted', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FlakyR2Client(8);
  const delays: number[] = [];

  await assert.rejects(
    syncDayBundleWithRetry(
      settings,
      day,
      'device-retry-fail',
      [],
      new Map(),
      new Map(),
      {
        client,
        retry: {
          policy: {
            maxRetries: 2,
            baseDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2,
          },
          sleep: async (ms) => {
            delays.push(ms);
          },
        },
      },
    ),
    /transient sync failure/,
  );

  assert.deepEqual(delays, [10, 20]);
});

test('syncDayBundle is idempotent under repeated uploads and pulls', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  const localEvents = [
    createEvent({
      eventId: 'event-idempotent',
      deviceId: 'device-repeat',
      startedAt: Date.parse('2026-03-27T08:00:00.000Z'),
      endedAt: Date.parse('2026-03-27T08:30:00.000Z'),
    }),
  ];
  const localAnnotations = new Map<string, Annotation>([
    [
      'event-idempotent',
      createAnnotation({
        category: 'work',
        updatedAt: 100,
        updatedByDeviceId: 'device-repeat',
      }),
    ],
  ]);
  const localReports = new Map<string, SyncReportArtifact>([
    [
      `daily:${day}`,
      createReport({
        periodKey: day,
        updatedAt: 100,
        updatedByDeviceId: 'device-repeat',
        content: 'idempotent report',
      }),
    ],
  ]);

  const first = await syncDayBundle(
    settings,
    day,
    'device-repeat',
    localEvents,
    localAnnotations,
    localReports,
    options,
  );
  const second = await syncDayBundle(
    settings,
    day,
    'device-repeat',
    localEvents,
    localAnnotations,
    localReports,
    options,
  );
  const third = await syncDayBundle(
    settings,
    day,
    'device-observer',
    [],
    new Map(),
    new Map(),
    options,
  );

  assert.equal(first.mergedEvents.length, 1);
  assert.equal(second.mergedEvents.length, 1);
  assert.equal(third.mergedEvents.length, 1);
  assert.equal(second.mergedAnnotations.size, 1);
  assert.equal(second.mergedReports.size, 1);
  assert.equal(second.mergedEvents[0]?.eventId, 'event-idempotent');
  assert.equal(third.mergedAnnotations.get('event-idempotent')?.primaryCategory, 'work');
  assert.equal(third.mergedReports.get(`daily:${day}`)?.content, 'idempotent report');
});

test('syncDay append optimization only writes missing local events as new shards', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  const eventA = createEvent({
    eventId: 'event-append-a',
    deviceId: 'device-append',
    startedAt: Date.parse('2026-03-27T08:00:00.000Z'),
    endedAt: Date.parse('2026-03-27T08:30:00.000Z'),
  });

  const first = await syncDay(settings, day, 'device-append', [eventA], options);
  assert.equal(first.mergedEvents.length, 1);
  const firstEventObjectWrites = client.putKeys().filter((key) => key.endsWith('.ndjson'));
  assert.equal(firstEventObjectWrites.length, 1);

  const second = await syncDay(settings, day, 'device-append', [eventA], options);
  assert.equal(second.mergedEvents.length, 1);
  const secondEventObjectWrites = client.putKeys().filter((key) => key.endsWith('.ndjson'));
  assert.equal(secondEventObjectWrites.length, 1);

  const eventB = createEvent({
    eventId: 'event-append-b',
    deviceId: 'device-append',
    startedAt: Date.parse('2026-03-27T08:30:00.000Z'),
    endedAt: Date.parse('2026-03-27T09:00:00.000Z'),
  });
  const third = await syncDay(settings, day, 'device-append', [eventA, eventB], options);
  assert.equal(third.mergedEvents.length, 2);
  const thirdEventObjectWrites = client.putKeys().filter((key) => key.endsWith('.ndjson'));
  assert.equal(thirdEventObjectWrites.length, 2);
});

test('syncDayBundle supports encrypted payloads across devices with shared passphrase', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = {
    client,
    encryption: {
      passphrase: 'shared-secret-passphrase',
    },
  };

  await syncDayBundle(
    settings,
    day,
    'device-a',
    [
      createEvent({
        eventId: 'event-enc-a',
        deviceId: 'device-a',
        startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T09:30:00.000Z'),
      }),
    ],
    new Map([
      [
        'event-enc-a',
        createAnnotation({
          category: 'work',
          updatedAt: 100,
          updatedByDeviceId: 'device-a',
        }),
      ],
    ]),
    new Map([
      [
        `daily:${day}`,
        createReport({
          periodKey: day,
          updatedAt: 100,
          updatedByDeviceId: 'device-a',
          content: 'encrypted report',
        }),
      ],
    ]),
    options,
  );

  const eventKey = client.putKeys().find((key) => key.endsWith('.ndjson'));
  assert.ok(eventKey);
  const rawEventPayload = client.getRaw(eventKey ?? '');
  assert.ok(rawEventPayload);
  assert.match(rawEventPayload ?? '', /^ttsync-enc-v1:/);
  assert.equal((rawEventPayload ?? '').includes('event-enc-a'), false);

  const result = await syncDayBundle(
    settings,
    day,
    'device-b',
    [
      createEvent({
        eventId: 'event-enc-b',
        deviceId: 'device-b',
        startedAt: Date.parse('2026-03-27T10:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T10:20:00.000Z'),
      }),
    ],
    new Map(),
    new Map(),
    options,
  );

  assert.equal(result.mergedEvents.length, 2);
  assert.equal(result.mergedAnnotations.get('event-enc-a')?.primaryCategory, 'work');
  assert.equal(result.mergedReports.get(`daily:${day}`)?.content, 'encrypted report');
});

test('syncDay fails on encrypted payload when passphrase is missing', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();

  await syncDayBundle(
    settings,
    day,
    'device-a',
    [
      createEvent({
        eventId: 'event-enc-missing-key',
        deviceId: 'device-a',
        startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T09:30:00.000Z'),
      }),
    ],
    new Map(),
    new Map(),
    {
      client,
      encryption: {
        passphrase: 'secret-passphrase',
      },
    },
  );

  await assert.rejects(
    syncDay(settings, day, 'device-b', [], { client }),
    /encryption passphrase is missing/,
  );
});

test('syncDay fails on encrypted payload when passphrase is wrong', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();

  await syncDayBundle(
    settings,
    day,
    'device-a',
    [
      createEvent({
        eventId: 'event-enc-wrong-key',
        deviceId: 'device-a',
        startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T09:30:00.000Z'),
      }),
    ],
    new Map(),
    new Map(),
    {
      client,
      encryption: {
        passphrase: 'correct-passphrase',
      },
    },
  );

  await assert.rejects(
    syncDay(settings, day, 'device-b', [], {
      client,
      encryption: {
        passphrase: 'wrong-passphrase',
      },
    }),
    /Failed to decrypt sync payload/,
  );
});

test('syncDayBundle preserves annotation/report LWW tie-break semantics', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  await syncDayBundle(
    settings,
    day,
    'device-a',
    [],
    new Map([
      [
        'event-lww',
        createAnnotation({
          category: 'learning',
          updatedAt: 300,
          updatedByDeviceId: 'device-a',
        }),
      ],
    ]),
    new Map([
      [
        `daily:${day}`,
        createReport({
          periodKey: day,
          updatedAt: 300,
          updatedByDeviceId: 'device-a',
          content: 'report-a',
        }),
      ],
    ]),
    options,
  );

  const result = await syncDayBundle(
    settings,
    day,
    'device-z',
    [],
    new Map([
      [
        'event-lww',
        createAnnotation({
          category: 'work',
          updatedAt: 300,
          updatedByDeviceId: 'device-z',
        }),
      ],
    ]),
    new Map([
      [
        `daily:${day}`,
        createReport({
          periodKey: day,
          updatedAt: 300,
          updatedByDeviceId: 'device-z',
          content: 'report-z',
        }),
      ],
    ]),
    options,
  );

  assert.equal(result.mergedAnnotations.get('event-lww')?.primaryCategory, 'work');
  assert.equal(result.mergedReports.get(`daily:${day}`)?.content, 'report-z');
});

test('syncDayBundle keeps valid annotation/report entries when payload has mixed invalid entries', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };

  client.putRaw(
    buildDailyDeviceAnnotationsObjectKey(day, 'mixed-device'),
    JSON.stringify({
      schemaVersion: 1,
      annotations: {
        'event-valid': {
          primaryCategory: 'work',
          tags: ['focus'],
          updatedAt: 10,
          updatedByDeviceId: 'mixed-device',
        },
        'event-invalid': {
          primaryCategory: 'broken',
          tags: 'not-array',
          updatedAt: 11,
          updatedByDeviceId: 'mixed-device',
        },
      },
    }),
  );
  client.putRaw(
    buildDailyDeviceReportsObjectKey(day, 'mixed-device'),
    JSON.stringify({
      schemaVersion: 1,
      reports: {
        [`daily:${day}`]: {
          periodType: 'daily',
          periodKey: day,
          generatedAt: 20,
          updatedAt: 20,
          updatedByDeviceId: 'mixed-device',
          source: 'manual',
          content: 'valid mixed report',
        },
        'daily:bad': {
          periodType: 'daily',
          periodKey: 'bad',
          generatedAt: 21,
          updatedAt: 21,
          updatedByDeviceId: 'mixed-device',
          source: 'invalid-source',
          content: 'invalid mixed report',
        },
      },
    }),
  );

  const result = await syncDayBundle(
    settings,
    day,
    'device-local',
    [],
    new Map(),
    new Map(),
    options,
  );

  assert.equal(result.invalidAnnotationObjects, 0);
  assert.equal(result.invalidReportObjects, 0);
  assert.ok(result.invalidAnnotationEntries >= 1);
  assert.ok(result.invalidReportEntries >= 1);
  assert.equal(result.mergedAnnotations.get('event-valid')?.primaryCategory, 'work');
  assert.equal(result.mergedAnnotations.has('event-invalid'), false);
  assert.equal(result.mergedReports.get(`daily:${day}`)?.content, 'valid mixed report');
  assert.equal(result.mergedReports.has('daily:bad'), false);
});

test('cross-device convergence gate is repeatable and converges within minute-level window', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const base = Date.parse('2026-03-27T08:00:00.000Z');
  const latestWriteAt = base + 40_000;
  const convergenceObservedAt = base + 90_000;
  const convergenceWindowMs = 60_000;

  async function runScenario(): Promise<{
    desktop: DeviceState;
    mobile: DeviceState;
    convergenceLagMs: number;
  }> {
    const client = new FakeR2Client();
    const options: SyncExecutionOptions = { client };

    const sharedEvent = createEvent({
      eventId: 'event-shared',
      deviceId: 'desktop',
      startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
      endedAt: Date.parse('2026-03-27T09:30:00.000Z'),
    });

    let desktop = cloneState({
      allEvents: [
        sharedEvent,
        createEvent({
          eventId: 'event-desktop-only',
          deviceId: 'desktop',
          startedAt: Date.parse('2026-03-27T10:00:00.000Z'),
          endedAt: Date.parse('2026-03-27T10:10:00.000Z'),
        }),
      ],
      annotations: new Map([
        [
          'event-shared',
          createAnnotation({
            category: 'work',
            updatedAt: base + 10_000,
            updatedByDeviceId: 'desktop',
          }),
        ],
      ]),
      reports: new Map([
        [
          `daily:${day}`,
          createReport({
            periodKey: day,
            updatedAt: base + 10_000,
            updatedByDeviceId: 'desktop',
            content: 'desktop report',
          }),
        ],
      ]),
    });

    let mobile = cloneState({
      allEvents: [
        sharedEvent,
        createEvent({
          eventId: 'event-mobile-only',
          deviceId: 'mobile',
          startedAt: Date.parse('2026-03-27T10:05:00.000Z'),
          endedAt: Date.parse('2026-03-27T10:20:00.000Z'),
        }),
      ],
      annotations: new Map([
        [
          'event-shared',
          createAnnotation({
            category: 'learning',
            updatedAt: latestWriteAt,
            updatedByDeviceId: 'mobile',
          }),
        ],
      ]),
      reports: new Map([
        [
          `daily:${day}`,
          createReport({
            periodKey: day,
            updatedAt: latestWriteAt,
            updatedByDeviceId: 'mobile',
            content: 'mobile report',
          }),
        ],
      ]),
    });

    desktop = await syncRound({ settings, day, deviceId: 'desktop', state: desktop, options });
    mobile = await syncRound({ settings, day, deviceId: 'mobile', state: mobile, options });
    desktop = await syncRound({ settings, day, deviceId: 'desktop', state: desktop, options });
    mobile = await syncRound({ settings, day, deviceId: 'mobile', state: mobile, options });

    return {
      desktop,
      mobile,
      convergenceLagMs: convergenceObservedAt - latestWriteAt,
    };
  }

  const first = await runScenario();
  const second = await runScenario();

  assert.deepEqual(canonicalizeState(first.desktop), canonicalizeState(first.mobile));
  assert.deepEqual(canonicalizeState(first.desktop), canonicalizeState(second.desktop));
  assert.ok(first.convergenceLagMs <= convergenceWindowMs);
  assert.equal(first.desktop.annotations.get('event-shared')?.primaryCategory, 'learning');
  assert.equal(first.desktop.reports.get(`daily:${day}`)?.content, 'mobile report');
});

test('cross-device convergence gate keeps residual variance within accepted minute-level bound before final pull', async () => {
  const day = '2026-03-27';
  const settings = createSyncSettings();
  const client = new FakeR2Client();
  const options: SyncExecutionOptions = { client };
  const acceptedVarianceMs = 60_000;

  let desktop = cloneState({
    allEvents: [
      createEvent({
        eventId: 'event-desktop-main',
        deviceId: 'desktop',
        startedAt: Date.parse('2026-03-27T09:00:00.000Z'),
        endedAt: Date.parse('2026-03-27T09:30:00.000Z'),
      }),
    ],
    annotations: new Map(),
    reports: new Map(),
  });

  let mobile = cloneState({
    allEvents: [
      createEvent({
        eventId: 'event-mobile-delta',
        deviceId: 'mobile',
        startedAt: Date.parse('2026-03-27T09:31:00.000Z'),
        endedAt: Date.parse('2026-03-27T09:31:45.000Z'),
      }),
    ],
    annotations: new Map(),
    reports: new Map(),
  });

  desktop = await syncRound({ settings, day, deviceId: 'desktop', state: desktop, options });
  mobile = await syncRound({ settings, day, deviceId: 'mobile', state: mobile, options });

  const beforeFinalPullGap = summaryGapMs(day, desktop, mobile);
  assert.ok(beforeFinalPullGap.stackedGapMs > 0);
  assert.ok(beforeFinalPullGap.stackedGapMs <= acceptedVarianceMs);
  assert.ok(beforeFinalPullGap.naturalGapMs <= acceptedVarianceMs);

  desktop = await syncRound({ settings, day, deviceId: 'desktop', state: desktop, options });
  mobile = await syncRound({ settings, day, deviceId: 'mobile', state: mobile, options });

  const afterConvergenceGap = summaryGapMs(day, desktop, mobile);
  assert.equal(afterConvergenceGap.stackedGapMs, 0);
  assert.equal(afterConvergenceGap.naturalGapMs, 0);
});
