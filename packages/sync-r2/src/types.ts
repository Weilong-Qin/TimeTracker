import type { SyncSettings } from '@timetracker/core';

export interface R2SyncObjectDescriptor {
  day: string;
  deviceId: string;
  key: string;
}

function assertDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid day format: ${day}`);
  }
}

export function buildDailyDeviceObjectKey(day: string, deviceId: string): string {
  assertDay(day);

  if (!deviceId.trim()) {
    throw new Error('deviceId is required');
  }

  return `${day}/${deviceId}.ndjson`;
}

export function parseDailyDeviceObjectKey(key: string): R2SyncObjectDescriptor {
  const match = key.match(/^(\d{4}-\d{2}-\d{2})\/([^/]+)\.ndjson$/);

  if (!match) {
    throw new Error(`Invalid sync object key: ${key}`);
  }

  const [, day, deviceId] = match;
  return { day, deviceId, key };
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
