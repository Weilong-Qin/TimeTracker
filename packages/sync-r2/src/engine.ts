import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import {
  mergeAnnotations,
  mergeEventBatches,
  type ActivityEvent,
  type Annotation,
  type SyncSettings,
} from '@timetracker/core';
import { createR2Client } from './client.js';
import { decodeEventsFromNdjson, encodeEventsToNdjson } from './ndjson.js';
import {
  buildDailyDeviceAnnotationsObjectKey,
  buildDailyDeviceObjectKey,
  buildDailyDeviceReportsObjectKey,
  type SyncReportArtifact,
  validateSyncSettings,
} from './types.js';
import { runWithRetry, type RetryExecutionOptions } from './retry.js';
import {
  decryptSyncPayload,
  encryptSyncPayload,
  isEncryptedSyncPayload,
  resolveEncryptionOptions,
  type SyncEncryptionOptions,
} from './crypto.js';

export interface PullDayResult {
  events: ActivityEvent[];
  invalidLines: number;
  objectsRead: number;
}

export interface PullDayAnnotationsResult {
  annotations: Map<string, Annotation>;
  objectsRead: number;
  invalidObjects: number;
  invalidEntries: number;
}

export interface PullDayReportsResult {
  reports: Map<string, SyncReportArtifact>;
  objectsRead: number;
  invalidObjects: number;
  invalidEntries: number;
}

export interface SyncDayResult {
  day: string;
  mergedEvents: ActivityEvent[];
  duplicates: number;
  invalidEvents: number;
  invalidLines: number;
  objectsRead: number;
}

export interface SyncDayBundleResult extends SyncDayResult {
  mergedAnnotations: Map<string, Annotation>;
  mergedReports: Map<string, SyncReportArtifact>;
  annotationObjectsRead: number;
  reportObjectsRead: number;
  invalidAnnotationObjects: number;
  invalidReportObjects: number;
  invalidAnnotationEntries: number;
  invalidReportEntries: number;
}

export interface SyncExecutionOptions {
  client?: SyncClientLike;
  retry?: RetryExecutionOptions;
  encryption?: SyncEncryptionOptions;
}

interface SyncClientLike {
  send(command: unknown): Promise<unknown>;
}

interface VersionedAnnotationsPayload {
  schemaVersion: number;
  annotations: Record<string, Annotation>;
}

interface VersionedReportsPayload {
  schemaVersion: number;
  reports: Record<string, SyncReportArtifact>;
}

interface DecodeAnnotationsPayloadResult {
  annotations: Map<string, Annotation>;
  invalidObject: boolean;
  invalidEntries: number;
}

interface DecodeReportsPayloadResult {
  reports: Map<string, SyncReportArtifact>;
  invalidObject: boolean;
  invalidEntries: number;
}

const SYNC_PAYLOAD_SCHEMA_VERSION = 1;

async function bodyToString(body: GetObjectCommandOutput['Body']): Promise<string> {
  if (!body) {
    return '';
  }

  if ('transformToString' in body && typeof body.transformToString === 'function') {
    return await body.transformToString();
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return await body.text();
  }

  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    const response = new Response(body);
    return await response.text();
  }

  if (typeof Uint8Array !== 'undefined' && body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (typeof body === 'string') {
    return body;
  }

  throw new Error('Unsupported object body type for R2 getObject');
}

function uniqueAndSorted(events: ActivityEvent[]): ActivityEvent[] {
  return mergeEventBatches([events]).merged;
}

function hasSuffix(key: string | undefined, suffix: string): key is string {
  return typeof key === 'string' && key.endsWith(suffix);
}

function isNdjsonKey(key: string | undefined): key is string {
  return hasSuffix(key, '.ndjson');
}

function isAnnotationsKey(key: string | undefined): key is string {
  return hasSuffix(key, '.annotations.json');
}

function isReportsKey(key: string | undefined): key is string {
  return hasSuffix(key, '.reports.json');
}

function resolveClient(settings: SyncSettings, options?: SyncExecutionOptions): SyncClientLike {
  return options?.client ?? createR2Client(settings);
}

async function encodeSyncPayload(raw: string, options?: SyncExecutionOptions): Promise<string> {
  const encryption = resolveEncryptionOptions(options?.encryption);
  if (!encryption) {
    return raw;
  }
  return encryptSyncPayload(raw, encryption);
}

async function decodeSyncPayload(raw: string, options?: SyncExecutionOptions): Promise<string> {
  if (!isEncryptedSyncPayload(raw)) {
    return raw;
  }

  const encryption = resolveEncryptionOptions(options?.encryption);
  if (!encryption) {
    throw new Error('Encrypted sync payload found but encryption passphrase is missing');
  }
  return decryptSyncPayload(raw, encryption);
}

function buildAppendShardObjectKey(day: string, deviceId: string): string {
  const legacyKey = buildDailyDeviceObjectKey(day, deviceId);
  const suffix = '.ndjson';
  const basePrefix = legacyKey.endsWith(suffix) ? legacyKey.slice(0, -suffix.length) : legacyKey;
  const entropy = Math.floor(Math.random() * 0x100000000)
    .toString(16)
    .padStart(8, '0');
  return `${basePrefix}/${Date.now()}-${entropy}.ndjson`;
}

function selectMissingLocalEvents(
  localDeviceEvents: ActivityEvent[],
  remoteEvents: ActivityEvent[],
): ActivityEvent[] {
  const remoteEventIds = new Set(remoteEvents.map((event) => event.eventId));
  return uniqueAndSorted(localDeviceEvents).filter((event) => !remoteEventIds.has(event.eventId));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toAnnotation(value: unknown): Annotation | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (!isStringArray(payload.tags)) {
    return null;
  }

  if (
    typeof payload.updatedAt !== 'number' ||
    !Number.isFinite(payload.updatedAt) ||
    typeof payload.updatedByDeviceId !== 'string'
  ) {
    return null;
  }

  const primaryCategory =
    typeof payload.primaryCategory === 'string' ? payload.primaryCategory : undefined;
  const note = typeof payload.note === 'string' ? payload.note : undefined;

  return {
    primaryCategory,
    tags: payload.tags,
    note,
    updatedAt: payload.updatedAt,
    updatedByDeviceId: payload.updatedByDeviceId,
  };
}

function isReportPeriodType(value: unknown): value is SyncReportArtifact['periodType'] {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function isReportSource(value: unknown): value is SyncReportArtifact['source'] {
  return value === 'ai' || value === 'fallback' || value === 'manual';
}

function toSyncReportArtifact(value: unknown): SyncReportArtifact | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (
    !isReportPeriodType(payload.periodType) ||
    typeof payload.periodKey !== 'string' ||
    typeof payload.generatedAt !== 'number' ||
    !Number.isFinite(payload.generatedAt) ||
    typeof payload.updatedAt !== 'number' ||
    !Number.isFinite(payload.updatedAt) ||
    typeof payload.updatedByDeviceId !== 'string' ||
    !isReportSource(payload.source) ||
    typeof payload.content !== 'string'
  ) {
    return null;
  }

  return {
    periodType: payload.periodType,
    periodKey: payload.periodKey,
    generatedAt: payload.generatedAt,
    updatedAt: payload.updatedAt,
    updatedByDeviceId: payload.updatedByDeviceId,
    source: payload.source,
    content: payload.content,
  };
}

function encodeAnnotationsPayload(annotations: ReadonlyMap<string, Annotation>): string {
  const payload: VersionedAnnotationsPayload = {
    schemaVersion: SYNC_PAYLOAD_SCHEMA_VERSION,
    annotations: Object.fromEntries(annotations.entries()),
  };
  return JSON.stringify(payload);
}

function encodeReportsPayload(reports: ReadonlyMap<string, SyncReportArtifact>): string {
  const payload: VersionedReportsPayload = {
    schemaVersion: SYNC_PAYLOAD_SCHEMA_VERSION,
    reports: Object.fromEntries(reports.entries()),
  };
  return JSON.stringify(payload);
}

function decodeAnnotationsPayload(raw: string): DecodeAnnotationsPayloadResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return { annotations: new Map(), invalidObject: true, invalidEntries: 0 };
    }

    const payload = parsed as Partial<VersionedAnnotationsPayload>;
    if (
      payload.schemaVersion !== SYNC_PAYLOAD_SCHEMA_VERSION ||
      typeof payload.annotations !== 'object' ||
      payload.annotations === null
    ) {
      return { annotations: new Map(), invalidObject: true, invalidEntries: 0 };
    }

    const annotations = new Map<string, Annotation>();
    let invalidEntries = 0;

    for (const [eventId, value] of Object.entries(payload.annotations)) {
      const parsedAnnotation = toAnnotation(value);
      if (!parsedAnnotation) {
        invalidEntries += 1;
        continue;
      }

      annotations.set(eventId, parsedAnnotation);
    }

    return {
      annotations,
      invalidObject: false,
      invalidEntries,
    };
  } catch {
    return { annotations: new Map(), invalidObject: true, invalidEntries: 0 };
  }
}

function decodeReportsPayload(raw: string): DecodeReportsPayloadResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return { reports: new Map(), invalidObject: true, invalidEntries: 0 };
    }

    const payload = parsed as Partial<VersionedReportsPayload>;
    if (
      payload.schemaVersion !== SYNC_PAYLOAD_SCHEMA_VERSION ||
      typeof payload.reports !== 'object' ||
      payload.reports === null
    ) {
      return { reports: new Map(), invalidObject: true, invalidEntries: 0 };
    }

    const reports = new Map<string, SyncReportArtifact>();
    let invalidEntries = 0;

    for (const [reportId, value] of Object.entries(payload.reports)) {
      const parsedReport = toSyncReportArtifact(value);
      if (!parsedReport) {
        invalidEntries += 1;
        continue;
      }

      reports.set(reportId, parsedReport);
    }

    return {
      reports,
      invalidObject: false,
      invalidEntries,
    };
  } catch {
    return { reports: new Map(), invalidObject: true, invalidEntries: 0 };
  }
}

export function resolveReportArtifactLww(
  current: SyncReportArtifact | undefined,
  incoming: SyncReportArtifact,
): SyncReportArtifact {
  if (!current) {
    return incoming;
  }

  if (incoming.updatedAt > current.updatedAt) {
    return incoming;
  }

  if (incoming.updatedAt < current.updatedAt) {
    return current;
  }

  return incoming.updatedByDeviceId.localeCompare(current.updatedByDeviceId) >= 0
    ? incoming
    : current;
}

export function mergeReportArtifacts(
  current: ReadonlyMap<string, SyncReportArtifact>,
  incoming: ReadonlyMap<string, SyncReportArtifact>,
): Map<string, SyncReportArtifact> {
  const merged = new Map(current);

  for (const [reportId, nextArtifact] of incoming.entries()) {
    const selected = resolveReportArtifactLww(merged.get(reportId), nextArtifact);
    merged.set(reportId, selected);
  }

  return merged;
}

export async function pushDayShard(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
  options?: SyncExecutionOptions,
): Promise<{ key: string; pushed: number }> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const key = buildDailyDeviceObjectKey(day, deviceId);
  const client = resolveClient(settings, options);
  const serialized = await encodeSyncPayload(
    encodeEventsToNdjson(uniqueAndSorted(localDeviceEvents)),
    options,
  );

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: serialized,
      ContentType: 'application/x-ndjson; charset=utf-8',
    }),
  );

  return {
    key,
    pushed: localDeviceEvents.length,
  };
}

async function pushDayShardAppend(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  deltaEvents: ActivityEvent[],
  options?: SyncExecutionOptions,
): Promise<{ key: string | null; pushed: number }> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const normalizedDelta = uniqueAndSorted(deltaEvents);
  if (normalizedDelta.length === 0) {
    return {
      key: null,
      pushed: 0,
    };
  }

  const key = buildAppendShardObjectKey(day, deviceId);
  const client = resolveClient(settings, options);
  const serialized = await encodeSyncPayload(encodeEventsToNdjson(normalizedDelta), options);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: serialized,
      ContentType: 'application/x-ndjson; charset=utf-8',
    }),
  );

  return {
    key,
    pushed: normalizedDelta.length,
  };
}

export async function pullDayEvents(settings: SyncSettings, day: string): Promise<PullDayResult> {
  return pullDayEventsWithOptions(settings, day);
}

async function pullDayEventsWithOptions(
  settings: SyncSettings,
  day: string,
  options?: SyncExecutionOptions,
): Promise<PullDayResult> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const client = resolveClient(settings, options);
  const prefix = `${day}/`;

  let continuationToken: string | undefined;
  let objectsRead = 0;
  let invalidLines = 0;
  const batches: ActivityEvent[][] = [];

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    ) as {
      Contents?: Array<{ Key?: string }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };

    const objectKeys = (listed.Contents ?? [])
      .map((entry) => entry.Key)
      .filter((key): key is string => isNdjsonKey(key));

    for (const key of objectKeys) {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: settings.bucket,
          Key: key,
        }),
      ) as GetObjectCommandOutput;

      const payload = await bodyToString(object.Body);
      const decodedPayload = await decodeSyncPayload(payload, options);
      const decoded = decodeEventsFromNdjson(decodedPayload);
      batches.push(decoded.events);
      invalidLines += decoded.invalidLines;
      objectsRead += 1;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return {
    events: mergeEventBatches(batches).merged,
    invalidLines,
    objectsRead,
  };
}

export async function pushDayAnnotations(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localAnnotations: ReadonlyMap<string, Annotation>,
  options?: SyncExecutionOptions,
): Promise<{ key: string; pushed: number }> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const key = buildDailyDeviceAnnotationsObjectKey(day, deviceId);
  const client = resolveClient(settings, options);
  const serialized = await encodeSyncPayload(encodeAnnotationsPayload(localAnnotations), options);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: serialized,
      ContentType: 'application/json; charset=utf-8',
    }),
  );

  return {
    key,
    pushed: localAnnotations.size,
  };
}

export async function pullDayAnnotations(
  settings: SyncSettings,
  day: string,
  options?: SyncExecutionOptions,
): Promise<PullDayAnnotationsResult> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const client = resolveClient(settings, options);
  const prefix = `${day}/`;
  let continuationToken: string | undefined;
  let objectsRead = 0;
  let invalidObjects = 0;
  let invalidEntries = 0;
  let mergedAnnotations = new Map<string, Annotation>();

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    ) as {
      Contents?: Array<{ Key?: string }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };

    const objectKeys = (listed.Contents ?? [])
      .map((entry) => entry.Key)
      .filter((key): key is string => isAnnotationsKey(key));

    for (const key of objectKeys) {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: settings.bucket,
          Key: key,
        }),
      ) as GetObjectCommandOutput;

      const payload = await bodyToString(object.Body);
      const decodedPayload = await decodeSyncPayload(payload, options);
      const decoded = decodeAnnotationsPayload(decodedPayload);
      objectsRead += 1;
      invalidEntries += decoded.invalidEntries;
      if (decoded.invalidObject) {
        invalidObjects += 1;
        continue;
      }

      mergedAnnotations = mergeAnnotations(mergedAnnotations, decoded.annotations);
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return {
    annotations: mergedAnnotations,
    objectsRead,
    invalidObjects,
    invalidEntries,
  };
}

export async function pushDayReports(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localReports: ReadonlyMap<string, SyncReportArtifact>,
  options?: SyncExecutionOptions,
): Promise<{ key: string; pushed: number }> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const key = buildDailyDeviceReportsObjectKey(day, deviceId);
  const client = resolveClient(settings, options);
  const serialized = await encodeSyncPayload(encodeReportsPayload(localReports), options);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: serialized,
      ContentType: 'application/json; charset=utf-8',
    }),
  );

  return {
    key,
    pushed: localReports.size,
  };
}

export async function pullDayReports(
  settings: SyncSettings,
  day: string,
  options?: SyncExecutionOptions,
): Promise<PullDayReportsResult> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const client = resolveClient(settings, options);
  const prefix = `${day}/`;
  let continuationToken: string | undefined;
  let objectsRead = 0;
  let invalidObjects = 0;
  let invalidEntries = 0;
  let mergedReports = new Map<string, SyncReportArtifact>();

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    ) as {
      Contents?: Array<{ Key?: string }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };

    const objectKeys = (listed.Contents ?? [])
      .map((entry) => entry.Key)
      .filter((key): key is string => isReportsKey(key));

    for (const key of objectKeys) {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: settings.bucket,
          Key: key,
        }),
      ) as GetObjectCommandOutput;

      const payload = await bodyToString(object.Body);
      const decodedPayload = await decodeSyncPayload(payload, options);
      const decoded = decodeReportsPayload(decodedPayload);
      objectsRead += 1;
      invalidEntries += decoded.invalidEntries;
      if (decoded.invalidObject) {
        invalidObjects += 1;
        continue;
      }

      mergedReports = mergeReportArtifacts(mergedReports, decoded.reports);
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return {
    reports: mergedReports,
    objectsRead,
    invalidObjects,
    invalidEntries,
  };
}

export async function syncDay(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
  options?: SyncExecutionOptions,
): Promise<SyncDayResult> {
  const pulled = await pullDayEventsWithOptions(settings, day, options);
  const deltaEvents = selectMissingLocalEvents(localDeviceEvents, pulled.events);
  await pushDayShardAppend(settings, day, deviceId, deltaEvents, options);

  const merged = mergeEventBatches([pulled.events, deltaEvents]);

  return {
    day,
    mergedEvents: merged.merged,
    duplicates: merged.duplicates,
    invalidEvents: merged.invalid,
    invalidLines: pulled.invalidLines,
    objectsRead: pulled.objectsRead,
  };
}

export async function syncDayWithRetry(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
  options?: SyncExecutionOptions,
): Promise<SyncDayResult> {
  return runWithRetry(
    () => syncDay(settings, day, deviceId, localDeviceEvents, options),
    options?.retry,
  );
}

export async function syncDayBundle(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
  localAnnotations: ReadonlyMap<string, Annotation>,
  localReports: ReadonlyMap<string, SyncReportArtifact>,
  options?: SyncExecutionOptions,
): Promise<SyncDayBundleResult> {
  const eventsResult = await syncDay(
    settings,
    day,
    deviceId,
    localDeviceEvents,
    options,
  );

  await pushDayAnnotations(settings, day, deviceId, localAnnotations, options);
  await pushDayReports(settings, day, deviceId, localReports, options);

  const pulledAnnotations = await pullDayAnnotations(settings, day, options);
  const pulledReports = await pullDayReports(settings, day, options);

  return {
    ...eventsResult,
    mergedAnnotations: mergeAnnotations(localAnnotations, pulledAnnotations.annotations),
    mergedReports: mergeReportArtifacts(localReports, pulledReports.reports),
    annotationObjectsRead: pulledAnnotations.objectsRead,
    reportObjectsRead: pulledReports.objectsRead,
    invalidAnnotationObjects: pulledAnnotations.invalidObjects,
    invalidReportObjects: pulledReports.invalidObjects,
    invalidAnnotationEntries: pulledAnnotations.invalidEntries,
    invalidReportEntries: pulledReports.invalidEntries,
  };
}

export async function syncDayBundleWithRetry(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
  localAnnotations: ReadonlyMap<string, Annotation>,
  localReports: ReadonlyMap<string, SyncReportArtifact>,
  options?: SyncExecutionOptions,
): Promise<SyncDayBundleResult> {
  return runWithRetry(
    () =>
      syncDayBundle(
        settings,
        day,
        deviceId,
        localDeviceEvents,
        localAnnotations,
        localReports,
        options,
      ),
    options?.retry,
  );
}
