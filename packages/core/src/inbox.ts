import type { ActivityEvent, Annotation } from './types.js';

export interface PendingInboxItem {
  resourceKey: string;
  resourceTitle?: string;
  eventIds: string[];
  stackedMs: number;
  lastSeenAt: number;
}

export function buildPendingInbox(
  events: ActivityEvent[],
  annotations: ReadonlyMap<string, Annotation>,
): PendingInboxItem[] {
  const buckets = new Map<string, PendingInboxItem>();

  for (const event of events) {
    const annotation = annotations.get(event.eventId);
    const isClassified = Boolean(annotation?.primaryCategory);

    if (isClassified) {
      continue;
    }

    const key = `${event.resourceKind}:${event.resourceKey}`;
    const current = buckets.get(key);
    const duration = Math.max(0, event.endedAt - event.startedAt);

    if (!current) {
      buckets.set(key, {
        resourceKey: event.resourceKey,
        resourceTitle: event.resourceTitle,
        eventIds: [event.eventId],
        stackedMs: duration,
        lastSeenAt: event.endedAt,
      });
      continue;
    }

    current.eventIds.push(event.eventId);
    current.stackedMs += duration;
    current.lastSeenAt = Math.max(current.lastSeenAt, event.endedAt);

    if (!current.resourceTitle && event.resourceTitle) {
      current.resourceTitle = event.resourceTitle;
    }
  }

  return [...buckets.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
