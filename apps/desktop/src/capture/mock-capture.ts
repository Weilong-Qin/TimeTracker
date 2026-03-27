import type { ActivityEvent, ResourceKind } from '@timetracker/core';

const WEB_SOURCES = [
  {
    key: 'https://docs.github.com/en',
    title: 'GitHub Docs - Pull requests',
  },
  {
    key: 'https://developers.cloudflare.com/r2/',
    title: 'Cloudflare R2 - Overview',
  },
  {
    key: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'YouTube - Music break',
  },
  {
    key: 'https://news.ycombinator.com/',
    title: 'Hacker News',
  },
];

const PROJECT_SOURCES = [
  {
    key: '/workspace/timetracker',
    title: 'timetracker (codex session)',
  },
  {
    key: '/workspace/client-dashboard',
    title: 'client-dashboard refactor',
  },
  {
    key: '/workspace/automation-scripts',
    title: 'automation-scripts maintenance',
  },
];

const DOCUMENT_SOURCES = [
  {
    key: 'doc://weekly-review',
    title: 'Weekly Review Draft',
  },
  {
    key: 'doc://product-prd',
    title: 'TimeTracker PRD v2',
  },
];

function pick<T>(values: readonly T[]): T {
  const index = Math.floor(Math.random() * values.length);
  return values[index];
}

function pickResource(): { kind: ResourceKind; key: string; title: string } {
  const weighted: Array<'web' | 'project' | 'document'> = ['web', 'web', 'project', 'project', 'document'];
  const target = pick(weighted);

  if (target === 'web') {
    const resource = pick(WEB_SOURCES);
    return { kind: 'web', key: resource.key, title: resource.title };
  }

  if (target === 'project') {
    const resource = pick(PROJECT_SOURCES);
    return { kind: 'project', key: resource.key, title: resource.title };
  }

  const resource = pick(DOCUMENT_SOURCES);
  return { kind: 'document', key: resource.key, title: resource.title };
}

function makeEventId(deviceId: string, now: number, salt: number): string {
  return `${deviceId}-${now}-${salt}`;
}

export function createMockCaptureEvent(deviceId: string, now = Date.now()): ActivityEvent {
  const resource = pickResource();
  const durationMs = (30 + Math.floor(Math.random() * 180)) * 1000;

  return {
    eventId: makeEventId(deviceId, now, Math.floor(Math.random() * 100_000)),
    deviceId,
    resourceKind: resource.kind,
    resourceKey: resource.key,
    resourceTitle: resource.title,
    startedAt: now - durationMs,
    endedAt: now,
    source: 'auto',
  };
}

export function createInitialSeedEvents(deviceId: string): ActivityEvent[] {
  const base = Date.now();

  return [
    {
      eventId: `${deviceId}-seed-1`,
      deviceId,
      resourceKind: 'project',
      resourceKey: '/workspace/timetracker',
      resourceTitle: 'timetracker (bootstrap)',
      startedAt: base - 50 * 60 * 1000,
      endedAt: base - 30 * 60 * 1000,
      source: 'auto',
    },
    {
      eventId: `${deviceId}-seed-2`,
      deviceId,
      resourceKind: 'web',
      resourceKey: 'https://developers.cloudflare.com/r2/',
      resourceTitle: 'Cloudflare R2 docs',
      startedAt: base - 45 * 60 * 1000,
      endedAt: base - 25 * 60 * 1000,
      source: 'auto',
    },
    {
      eventId: `${deviceId}-seed-3`,
      deviceId,
      resourceKind: 'document',
      resourceKey: 'doc://daily-journal',
      resourceTitle: 'Daily Journal',
      startedAt: base - 20 * 60 * 1000,
      endedAt: base - 10 * 60 * 1000,
      source: 'manual',
    },
  ];
}
