import type { ActivityEvent, SyncSettings } from '@timetracker/core';

export interface DesktopSyncRunnerResult {
  mergedEvents: ActivityEvent[];
  objectsRead: number;
}

export type DesktopSyncRunner = (
  settings: SyncSettings,
  day: string,
  deviceId: string,
  localDeviceEvents: ActivityEvent[],
) => Promise<DesktopSyncRunnerResult>;

export interface ExecuteDesktopSyncGateInput {
  settings: SyncSettings;
  day: string;
  deviceId: string;
  dayEvents: ActivityEvent[];
  runSync: DesktopSyncRunner;
}

export interface ExecuteDesktopSyncGateResult {
  skipped: boolean;
  message: string;
  mergedEvents: ActivityEvent[];
  objectsRead: number;
}

export async function executeDesktopSyncGate(
  input: ExecuteDesktopSyncGateInput,
): Promise<ExecuteDesktopSyncGateResult> {
  if (!input.settings.enabled) {
    return {
      skipped: true,
      message: 'sync disabled',
      mergedEvents: [],
      objectsRead: 0,
    };
  }

  const localDeviceEvents = input.dayEvents.filter(
    (event) => event.deviceId === input.deviceId,
  );
  const synced = await input.runSync(
    input.settings,
    input.day,
    input.deviceId,
    localDeviceEvents,
  );

  return {
    skipped: false,
    message: `synced ${synced.mergedEvents.length} events from ${synced.objectsRead} object(s)`,
    mergedEvents: synced.mergedEvents,
    objectsRead: synced.objectsRead,
  };
}
