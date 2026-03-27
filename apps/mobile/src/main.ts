import {
  InMemoryActivityStore,
  createManualEntry,
  type ActivityEvent,
} from '@timetracker/core';

const store = new InMemoryActivityStore();

function createBootstrapEvent(deviceId: string): ActivityEvent {
  const now = Date.now();

  return {
    eventId: `${deviceId}-${now}`,
    deviceId,
    resourceKind: 'manual',
    resourceKey: 'manual://reflection',
    resourceTitle: 'Daily reflection draft',
    startedAt: now - 10 * 60 * 1000,
    endedAt: now,
    source: 'manual',
  };
}

export function bootstrapMobileDemo(deviceId: string): void {
  const autoEvent = createBootstrapEvent(deviceId);
  const manualEvent = createManualEntry({
    eventId: `${deviceId}-manual-${Date.now()}`,
    deviceId,
    title: 'Gym and commute',
    startAt: Date.now() - 30 * 60 * 1000,
    endAt: Date.now() - 20 * 60 * 1000,
  });

  store.appendEvents([autoEvent, manualEvent]);

  const day = new Date().toISOString().slice(0, 10);
  const summary = store.summarizeDay(day);

  console.log('[mobile] bootstrap summary', {
    day,
    stackedMs: summary.stackedMs,
    naturalMs: summary.naturalMs,
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrapMobileDemo('mobile-local');
}
