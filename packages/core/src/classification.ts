import type { ActivityEvent, Annotation } from './types.js';

export interface CategorySummary {
  key: string;
  stackedMs: number;
  naturalMs: number;
}

export interface DailySummary {
  stackedMs: number;
  naturalMs: number;
  byPrimaryCategory: CategorySummary[];
  byTag: CategorySummary[];
}

export function durationMs(event: ActivityEvent): number {
  return Math.max(0, event.endedAt - event.startedAt);
}

export function computeStackedDuration(events: ActivityEvent[]): number {
  return events.reduce((total, event) => total + durationMs(event), 0);
}

export function computeNaturalDuration(events: ActivityEvent[]): number {
  if (events.length === 0) {
    return 0;
  }

  const sorted = [...events]
    .filter((event) => event.endedAt > event.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt);

  if (sorted.length === 0) {
    return 0;
  }

  let total = 0;
  let cursorStart = sorted[0].startedAt;
  let cursorEnd = sorted[0].endedAt;

  for (let index = 1; index < sorted.length; index += 1) {
    const event = sorted[index];
    if (event.startedAt <= cursorEnd) {
      cursorEnd = Math.max(cursorEnd, event.endedAt);
      continue;
    }

    total += cursorEnd - cursorStart;
    cursorStart = event.startedAt;
    cursorEnd = event.endedAt;
  }

  total += cursorEnd - cursorStart;
  return total;
}

function summarizeByKey(events: ActivityEvent[], keyResolver: (event: ActivityEvent) => string): CategorySummary[] {
  const buckets = new Map<string, ActivityEvent[]>();

  for (const event of events) {
    const key = keyResolver(event);
    const bucket = buckets.get(key) ?? [];
    bucket.push(event);
    buckets.set(key, bucket);
  }

  const result: CategorySummary[] = [];

  for (const [key, bucketEvents] of buckets.entries()) {
    result.push({
      key,
      stackedMs: computeStackedDuration(bucketEvents),
      naturalMs: computeNaturalDuration(bucketEvents),
    });
  }

  return result.sort((a, b) => b.stackedMs - a.stackedMs);
}

export function summarizeDaily(
  events: ActivityEvent[],
  annotationsByEventId: ReadonlyMap<string, Annotation>,
): DailySummary {
  const stackedMs = computeStackedDuration(events);
  const naturalMs = computeNaturalDuration(events);

  const byPrimaryCategory = summarizeByKey(events, (event) => {
    const annotation = annotationsByEventId.get(event.eventId);
    return annotation?.primaryCategory ?? 'uncategorized';
  });

  const exploded: ActivityEvent[] = [];
  const tagMap = new Map<string, ActivityEvent[]>();

  for (const event of events) {
    const annotation = annotationsByEventId.get(event.eventId);
    const tags = annotation?.tags ?? [];

    if (tags.length === 0) {
      const fallback = tagMap.get('untagged') ?? [];
      fallback.push(event);
      tagMap.set('untagged', fallback);
      continue;
    }

    for (const tag of tags) {
      const bucket = tagMap.get(tag) ?? [];
      bucket.push(event);
      tagMap.set(tag, bucket);
    }
  }

  for (const bucket of tagMap.values()) {
    exploded.push(...bucket);
  }

  const byTag = [...tagMap.entries()].map(([key, bucketEvents]) => ({
    key,
    stackedMs: computeStackedDuration(bucketEvents),
    naturalMs: computeNaturalDuration(bucketEvents),
  }));

  byTag.sort((a, b) => b.stackedMs - a.stackedMs);

  return {
    stackedMs,
    naturalMs,
    byPrimaryCategory,
    byTag,
  };
}
