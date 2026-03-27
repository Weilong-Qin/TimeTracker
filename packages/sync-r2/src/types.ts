import type { SyncSettings } from '@timetracker/core';

const EVENT_OBJECT_SUFFIX = '.ndjson';
const ANNOTATION_OBJECT_SUFFIX = '.annotations.json';
const REPORT_OBJECT_SUFFIX = '.reports.json';

export type R2SyncChannel = 'events' | 'annotations' | 'reports';
export type SyncReportPeriodType = 'daily' | 'weekly' | 'monthly';
export type SyncReportSource = 'ai' | 'fallback' | 'manual';

export interface SyncReportArtifact {
  periodType: SyncReportPeriodType;
  periodKey: string;
  generatedAt: number;
  updatedAt: number;
  updatedByDeviceId: string;
  source: SyncReportSource;
  content: string;
}

export interface R2SyncObjectDescriptor {
  channel: R2SyncChannel;
  day: string;
  deviceId: string;
  key: string;
}

function assertDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid day format: ${day}`);
  }
}

function assertDeviceId(deviceId: string): void {
  if (!deviceId.trim()) {
    throw new Error('deviceId is required');
  }
}

function buildDailyDeviceChannelObjectKey(day: string, deviceId: string, suffix: string): string {
  assertDay(day);
  assertDeviceId(deviceId);
  return `${day}/${deviceId}${suffix}`;
}

function parseDailyDeviceChannelObjectKey(
  key: string,
  suffix: string,
  channel: R2SyncChannel,
): R2SyncObjectDescriptor {
  const escapedSuffix = suffix
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = key.match(new RegExp(`^(\\d{4}-\\d{2}-\\d{2})/([^/]+)${escapedSuffix}$`));

  if (!match) {
    throw new Error(`Invalid ${channel} sync object key: ${key}`);
  }

  const [, day, deviceId] = match;
  return {
    channel,
    day,
    deviceId,
    key,
  };
}

export function buildDailyDeviceObjectKey(day: string, deviceId: string): string {
  return buildDailyDeviceChannelObjectKey(day, deviceId, EVENT_OBJECT_SUFFIX);
}

export function buildDailyDeviceAnnotationsObjectKey(day: string, deviceId: string): string {
  return buildDailyDeviceChannelObjectKey(day, deviceId, ANNOTATION_OBJECT_SUFFIX);
}

export function buildDailyDeviceReportsObjectKey(day: string, deviceId: string): string {
  return buildDailyDeviceChannelObjectKey(day, deviceId, REPORT_OBJECT_SUFFIX);
}

export function parseDailyDeviceObjectKey(key: string): R2SyncObjectDescriptor {
  return parseDailyDeviceChannelObjectKey(key, EVENT_OBJECT_SUFFIX, 'events');
}

export function parseDailyDeviceAnnotationsObjectKey(key: string): R2SyncObjectDescriptor {
  return parseDailyDeviceChannelObjectKey(key, ANNOTATION_OBJECT_SUFFIX, 'annotations');
}

export function parseDailyDeviceReportsObjectKey(key: string): R2SyncObjectDescriptor {
  return parseDailyDeviceChannelObjectKey(key, REPORT_OBJECT_SUFFIX, 'reports');
}

export function validateSyncSettings(input: SyncSettings): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!input.accountId.trim()) {
    issues.push('accountId is required');
  }

  if (!input.bucket.trim()) {
    issues.push('bucket is required');
  }

  if (!input.accessKeyId.trim()) {
    issues.push('accessKeyId is required');
  }

  if (!input.secretAccessKey.trim()) {
    issues.push('secretAccessKey is required');
  }

  if (!input.region.trim()) {
    issues.push('region is required');
  }

  if (![1, 5, 15, 30, 60].includes(input.syncIntervalMinutes)) {
    issues.push('syncIntervalMinutes must be one of 1/5/15/30/60');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
