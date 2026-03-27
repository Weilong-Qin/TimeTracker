import type { SyncSettings } from '@timetracker/core';

const DEFAULT_INTERVAL_MINUTES = 5;

function normalizeInterval(value: number): 1 | 5 | 15 | 30 | 60 {
  if (value === 1 || value === 5 || value === 15 || value === 30 || value === 60) {
    return value;
  }

  return DEFAULT_INTERVAL_MINUTES;
}

export function resolveSyncIntervalMinutes(settings: SyncSettings): 1 | 5 | 15 | 30 | 60 {
  return normalizeInterval(settings.syncIntervalMinutes);
}

export function nextSyncAt(settings: SyncSettings, nowMs: number): number {
  const intervalMinutes = resolveSyncIntervalMinutes(settings);
  return nowMs + intervalMinutes * 60 * 1000;
}

export function shouldSyncNow(settings: SyncSettings, nowMs: number, lastSyncAtMs: number | null): boolean {
  if (!settings.enabled) {
    return false;
  }

  if (lastSyncAtMs === null) {
    return true;
  }

  return nowMs - lastSyncAtMs >= resolveSyncIntervalMinutes(settings) * 60 * 1000;
}
