import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { mergeEventBatches, type ActivityEvent, type SyncSettings } from '@timetracker/core';
import { createR2Client } from './client.js';
import { decodeEventsFromNdjson, encodeEventsToNdjson } from './ndjson.js';
import { buildDailyDeviceObjectKey, validateSyncSettings } from './types.js';

export interface PullDayResult {
  events: ActivityEvent[];
  invalidLines: number;
  objectsRead: number;
}

export interface SyncDayResult {
  day: string;
  mergedEvents: ActivityEvent[];
  duplicates: number;
  invalidEvents: number;
  invalidLines: number;
  objectsRead: number;
}

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

function isNdjsonKey(key: string | undefined): key is string {
  return typeof key === 'string' && key.endsWith('.ndjson');
}

export async function pushDayShard(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
): Promise<{ key: string; pushed: number }> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const key = buildDailyDeviceObjectKey(day, deviceId);
  const client = createR2Client(settings);
  const serialized = encodeEventsToNdjson(uniqueAndSorted(localDeviceEvents));

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

export async function pullDayEvents(settings: SyncSettings, day: string): Promise<PullDayResult> {
  const validation = validateSyncSettings(settings);
  if (!validation.ok) {
    throw new Error(`Invalid sync settings: ${validation.issues.join(', ')}`);
  }

  const client = createR2Client(settings);
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
    );

    const objectKeys = (listed.Contents ?? [])
      .map((entry) => entry.Key)
      .filter((key): key is string => isNdjsonKey(key));

    for (const key of objectKeys) {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: settings.bucket,
          Key: key,
        }),
      );

      const payload = await bodyToString(object.Body);
      const decoded = decodeEventsFromNdjson(payload);
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

export async function syncDay(
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
): Promise<SyncDayResult> {
  await pushDayShard(settings, day, deviceId, localDeviceEvents);

  const pulled = await pullDayEvents(settings, day);
  const merged = mergeEventBatches([pulled.events]);

  return {
    day,
    mergedEvents: merged.merged,
    duplicates: merged.duplicates,
    invalidEvents: merged.invalid,
    invalidLines: pulled.invalidLines,
    objectsRead: pulled.objectsRead,
  };
}
