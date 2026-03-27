import {
  validateActivityEvent,
  type ActivityEvent,
  type ActivityEventRepository,
  type Annotation,
  type AnnotationRepository,
} from '@timetracker/core';

const CURRENT_STORAGE_SCHEMA_VERSION = 1;
const STORAGE_META_KEY = 'timetracker.desktop.storage.meta';

const RESOURCE_KINDS = new Set<ActivityEvent['resourceKind']>([
  'web',
  'document',
  'project',
  'app',
  'manual',
]);
const EVENT_SOURCES = new Set<ActivityEvent['source']>(['auto', 'manual']);

interface VersionedEventsPayload {
  schemaVersion: number;
  events: unknown[];
}

interface VersionedAnnotationsPayload {
  schemaVersion: number;
  annotations: Record<string, unknown>;
}

interface StorageMetaPayload {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  lastMigrationAt: number;
}

export interface MigrationReport {
  fromVersion: number;
  toVersion: number;
  migrated: boolean;
}

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DESKTOP_STORAGE_KEYS = {
  deviceId: 'timetracker.desktop.device-id',
  captureProvider: 'timetracker.desktop.capture-provider',
  captureIntervalMs: 'timetracker.desktop.capture-interval-ms',
  browserBridgeEnabled: 'timetracker.desktop.browser-bridge-enabled',
  browserBridgeSnapshot: 'timetracker.desktop.browser-bridge-snapshot',
  syncSettings: 'timetracker.desktop.sync-settings',
  syncTelemetry: 'timetracker.desktop.sync-telemetry',
  reportSettings: 'timetracker.desktop.report-settings',
  reportArtifacts: 'timetracker.desktop.reports',
  pushSettings: 'timetracker.desktop.push-settings',
  events: 'timetracker.desktop.events',
  annotations: 'timetracker.desktop.annotations',
} as const;

class InMemoryBrowserStorage implements BrowserStorage {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isResourceKind(value: unknown): value is ActivityEvent['resourceKind'] {
  return typeof value === 'string' && RESOURCE_KINDS.has(value as ActivityEvent['resourceKind']);
}

function isEventSource(value: unknown): value is ActivityEvent['source'] {
  return typeof value === 'string' && EVENT_SOURCES.has(value as ActivityEvent['source']);
}

function toActivityEvent(value: unknown): ActivityEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const event: ActivityEvent = {
    eventId: typeof value.eventId === 'string' ? value.eventId : '',
    deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
    resourceKind: isResourceKind(value.resourceKind) ? value.resourceKind : 'manual',
    resourceKey: typeof value.resourceKey === 'string' ? value.resourceKey : '',
    resourceTitle: typeof value.resourceTitle === 'string' ? value.resourceTitle : undefined,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : Number.NaN,
    endedAt: typeof value.endedAt === 'number' ? value.endedAt : Number.NaN,
    source: isEventSource(value.source) ? value.source : 'manual',
  };

  const validation = validateActivityEvent(event);
  if (!validation.valid) {
    return null;
  }

  return event;
}

function toAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isStringArray(value.tags)) {
    return null;
  }

  if (typeof value.updatedAt !== 'number' || typeof value.updatedByDeviceId !== 'string') {
    return null;
  }

  const primaryCategory =
    typeof value.primaryCategory === 'string'
      ? value.primaryCategory
      : undefined;
  const note = typeof value.note === 'string' ? value.note : undefined;

  return {
    primaryCategory,
    tags: value.tags,
    note,
    updatedAt: value.updatedAt,
    updatedByDeviceId: value.updatedByDeviceId,
  };
}

function nowMs(): number {
  return Date.now();
}

function parseJsonValue(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function isStorageMetaPayload(value: unknown): value is StorageMetaPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.schemaVersion === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    typeof value.lastMigrationAt === 'number'
  );
}

function createStorageMeta(schemaVersion: number): StorageMetaPayload {
  const time = nowMs();
  return {
    schemaVersion,
    createdAt: time,
    updatedAt: time,
    lastMigrationAt: 0,
  };
}

function readStorageMeta(storage: BrowserStorage): StorageMetaPayload | null {
  const raw = readStorageValue(storage, STORAGE_META_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = parseJsonValue(raw);
    if (!isStorageMetaPayload(parsed)) {
      throw new Error('invalid storage meta payload');
    }
    return parsed;
  } catch (error) {
    console.warn('[persistence] invalid storage meta, resetting metadata', error);
    quarantineCorruptedPayload(storage, STORAGE_META_KEY, raw);
    return null;
  }
}

function writeStorageMeta(storage: BrowserStorage, meta: StorageMetaPayload): boolean {
  return writeStorageValue(storage, STORAGE_META_KEY, JSON.stringify(meta));
}

function decodeLegacyEvents(value: unknown): ActivityEvent[] | null {
  if (Array.isArray(value)) {
    return value
      .map((item) => toActivityEvent(item))
      .filter((item): item is ActivityEvent => item !== null);
  }

  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.events)) {
    return value.events
      .map((item) => toActivityEvent(item))
      .filter((item): item is ActivityEvent => item !== null);
  }

  return null;
}

function decodeLegacyAnnotations(value: unknown): Map<string, Annotation> | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawAnnotations = isRecord(value.annotations) ? value.annotations : value;
  const annotations = new Map<string, Annotation>();
  let hasValidEntry = false;

  for (const [eventId, raw] of Object.entries(rawAnnotations)) {
    const parsed = toAnnotation(raw);
    if (!parsed) {
      continue;
    }
    annotations.set(eventId, parsed);
    hasValidEntry = true;
  }

  if (!hasValidEntry && Object.keys(rawAnnotations).length > 0) {
    return null;
  }

  return annotations;
}

function migrateEventsV0ToV1(storage: BrowserStorage): boolean {
  const raw = readStorageValue(storage, DESKTOP_STORAGE_KEYS.events);
  if (!raw) {
    return true;
  }

  try {
    const parsed = parseJsonValue(raw);

    if (
      isRecord(parsed) &&
      parsed.schemaVersion === CURRENT_STORAGE_SCHEMA_VERSION &&
      Array.isArray(parsed.events)
    ) {
      return true;
    }

    const legacy = decodeLegacyEvents(parsed);
    if (!legacy) {
      quarantineCorruptedPayload(storage, DESKTOP_STORAGE_KEYS.events, raw);
      return false;
    }

    writeEvents(storage, DESKTOP_STORAGE_KEYS.events, legacy);
    console.warn('[persistence] migrated legacy events payload to schema v1');
    return true;
  } catch (error) {
    console.warn('[persistence] failed to migrate events payload', error);
    quarantineCorruptedPayload(storage, DESKTOP_STORAGE_KEYS.events, raw);
    return false;
  }
}

function migrateAnnotationsV0ToV1(storage: BrowserStorage): boolean {
  const raw = readStorageValue(storage, DESKTOP_STORAGE_KEYS.annotations);
  if (!raw) {
    return true;
  }

  try {
    const parsed = parseJsonValue(raw);

    if (
      isRecord(parsed) &&
      parsed.schemaVersion === CURRENT_STORAGE_SCHEMA_VERSION &&
      isRecord(parsed.annotations)
    ) {
      return true;
    }

    const legacy = decodeLegacyAnnotations(parsed);
    if (!legacy) {
      quarantineCorruptedPayload(storage, DESKTOP_STORAGE_KEYS.annotations, raw);
      return false;
    }

    writeAnnotations(storage, DESKTOP_STORAGE_KEYS.annotations, legacy);
    console.warn('[persistence] migrated legacy annotations payload to schema v1');
    return true;
  } catch (error) {
    console.warn('[persistence] failed to migrate annotations payload', error);
    quarantineCorruptedPayload(storage, DESKTOP_STORAGE_KEYS.annotations, raw);
    return false;
  }
}

function migrateV0ToV1(storage: BrowserStorage): boolean {
  const eventsOk = migrateEventsV0ToV1(storage);
  const annotationsOk = migrateAnnotationsV0ToV1(storage);
  return eventsOk && annotationsOk;
}

export function runDesktopStorageMigrations(storage: BrowserStorage): MigrationReport {
  const existingMeta = readStorageMeta(storage);
  const initialVersion = existingMeta?.schemaVersion ?? 0;
  let version = initialVersion;
  let migrated = false;

  if (!existingMeta) {
    writeStorageMeta(storage, createStorageMeta(0));
  }

  if (version > CURRENT_STORAGE_SCHEMA_VERSION) {
    console.warn(
      `[persistence] storage schema ${version} is newer than runtime schema ${CURRENT_STORAGE_SCHEMA_VERSION}`,
    );
    return {
      fromVersion: version,
      toVersion: version,
      migrated: false,
    };
  }

  while (version < CURRENT_STORAGE_SCHEMA_VERSION) {
    if (version === 0) {
      migrateV0ToV1(storage);
      version = 1;
      migrated = true;
      continue;
    }

    console.warn(`[persistence] unsupported migration path from schema version ${version}`);
    break;
  }

  const previousMeta = readStorageMeta(storage) ?? createStorageMeta(initialVersion);
  const updatedMeta: StorageMetaPayload = {
    ...previousMeta,
    schemaVersion: version,
    updatedAt: nowMs(),
    lastMigrationAt: migrated ? nowMs() : previousMeta.lastMigrationAt,
  };
  writeStorageMeta(storage, updatedMeta);

  return {
    fromVersion: initialVersion,
    toVersion: version,
    migrated,
  };
}

function readStorageValue(storage: BrowserStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch (error) {
    console.warn(`[persistence] failed to read key: ${key}`, error);
    return null;
  }
}

function writeStorageValue(storage: BrowserStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[persistence] failed to write key: ${key}`, error);
    return false;
  }
}

function removeStorageValue(storage: BrowserStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn(`[persistence] failed to remove key: ${key}`, error);
  }
}

function quarantineCorruptedPayload(storage: BrowserStorage, key: string, raw: string): void {
  const quarantineKey = `${key}.corrupt.${Date.now()}`;
  writeStorageValue(storage, quarantineKey, raw);
  removeStorageValue(storage, key);
}

function readEvents(storage: BrowserStorage, key: string): ActivityEvent[] {
  const raw = readStorageValue(storage, key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('payload must be an object');
    }

    const payload = parsed as Partial<VersionedEventsPayload>;
    if (
      payload.schemaVersion !== CURRENT_STORAGE_SCHEMA_VERSION ||
      !Array.isArray(payload.events)
    ) {
      throw new Error('unsupported schema version or invalid events payload');
    }

    const result: ActivityEvent[] = [];
    let dropped = 0;
    for (const item of payload.events) {
      const normalized = toActivityEvent(item);
      if (normalized) {
        result.push(normalized);
      } else {
        dropped += 1;
      }
    }

    if (dropped > 0) {
      console.warn(`[persistence] dropped ${dropped} invalid event(s) from ${key}`);
    }

    return result;
  } catch (error) {
    console.warn(`[persistence] failed to parse ${key}, falling back to empty state`, error);
    quarantineCorruptedPayload(storage, key, raw);
    return [];
  }
}

function writeEvents(storage: BrowserStorage, key: string, events: ActivityEvent[]): void {
  const payload: VersionedEventsPayload = {
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    events,
  };

  writeStorageValue(storage, key, JSON.stringify(payload));
}

function readAnnotations(storage: BrowserStorage, key: string): Map<string, Annotation> {
  const raw = readStorageValue(storage, key);
  if (!raw) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('payload must be an object');
    }

    const payload = parsed as Partial<VersionedAnnotationsPayload>;
    if (
      payload.schemaVersion !== CURRENT_STORAGE_SCHEMA_VERSION ||
      !isRecord(payload.annotations)
    ) {
      throw new Error('unsupported schema version or invalid annotations payload');
    }

    const annotations = new Map<string, Annotation>();
    let dropped = 0;

    for (const [eventId, value] of Object.entries(payload.annotations)) {
      const normalized = toAnnotation(value);
      if (normalized) {
        annotations.set(eventId, normalized);
      } else {
        dropped += 1;
      }
    }

    if (dropped > 0) {
      console.warn(`[persistence] dropped ${dropped} invalid annotation(s) from ${key}`);
    }

    return annotations;
  } catch (error) {
    console.warn(`[persistence] failed to parse ${key}, falling back to empty state`, error);
    quarantineCorruptedPayload(storage, key, raw);
    return new Map();
  }
}

function writeAnnotations(
  storage: BrowserStorage,
  key: string,
  annotations: ReadonlyMap<string, Annotation>,
): void {
  const payload: VersionedAnnotationsPayload = {
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    annotations: Object.fromEntries(annotations.entries()),
  };

  writeStorageValue(storage, key, JSON.stringify(payload));
}

export function createDesktopStorage(): BrowserStorage {
  if (typeof window === 'undefined' || !window.localStorage) {
    return new InMemoryBrowserStorage();
  }

  try {
    const probeKey = 'timetracker.desktop.storage.probe';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch (error) {
    console.warn('[persistence] localStorage unavailable, using in-memory fallback', error);
    return new InMemoryBrowserStorage();
  }
}

export function readStoredValue(
  storage: BrowserStorage,
  key: string,
): string | null {
  return readStorageValue(storage, key);
}

export function writeStoredValue(
  storage: BrowserStorage,
  key: string,
  value: string,
): boolean {
  return writeStorageValue(storage, key, value);
}

export class LocalStorageActivityEventRepository implements ActivityEventRepository {
  private readonly storage: BrowserStorage;

  private readonly key: string;

  private events: ActivityEvent[];

  constructor(
    storage: BrowserStorage,
    key = DESKTOP_STORAGE_KEYS.events,
  ) {
    this.storage = storage;
    this.key = key;
    this.events = readEvents(storage, key);
  }

  readAll(): ActivityEvent[] {
    return [...this.events];
  }

  replaceAll(events: ActivityEvent[]): void {
    this.events = [...events];
    writeEvents(this.storage, this.key, this.events);
  }
}

export class LocalStorageAnnotationRepository implements AnnotationRepository {
  private readonly storage: BrowserStorage;

  private readonly key: string;

  private annotations: Map<string, Annotation>;

  constructor(
    storage: BrowserStorage,
    key = DESKTOP_STORAGE_KEYS.annotations,
  ) {
    this.storage = storage;
    this.key = key;
    this.annotations = readAnnotations(storage, key);
  }

  readAll(): ReadonlyMap<string, Annotation> {
    return this.annotations;
  }

  upsert(eventId: string, annotation: Annotation): Annotation {
    this.annotations.set(eventId, annotation);
    writeAnnotations(this.storage, this.key, this.annotations);
    return annotation;
  }

  replaceAll(annotations: ReadonlyMap<string, Annotation>): void {
    this.annotations = new Map(annotations.entries());
    writeAnnotations(this.storage, this.key, this.annotations);
  }
}
