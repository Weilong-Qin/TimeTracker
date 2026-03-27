import type { ActivityEvent, ValidationIssue, ValidationResult } from './types.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function validateActivityEvent(event: ActivityEvent): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmptyString(event.eventId)) {
    issues.push({ field: 'eventId', message: 'eventId is required' });
  }

  if (!isNonEmptyString(event.deviceId)) {
    issues.push({ field: 'deviceId', message: 'deviceId is required' });
  }

  if (!isNonEmptyString(event.resourceKey)) {
    issues.push({ field: 'resourceKey', message: 'resourceKey is required' });
  }

  if (event.endedAt <= event.startedAt) {
    issues.push({ field: 'endedAt', message: 'endedAt must be greater than startedAt' });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function toNdjsonLine(event: ActivityEvent): string {
  return JSON.stringify(event);
}

function toActivityEvent(value: unknown): ActivityEvent {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid NDJSON line: object expected');
  }

  const event = value as Partial<ActivityEvent>;

  if (
    !isNonEmptyString(event.eventId) ||
    !isNonEmptyString(event.deviceId) ||
    !isNonEmptyString(event.resourceKey) ||
    typeof event.startedAt !== 'number' ||
    typeof event.endedAt !== 'number' ||
    !isNonEmptyString(event.resourceKind) ||
    !isNonEmptyString(event.source)
  ) {
    throw new Error('Invalid NDJSON line: required fields missing or malformed');
  }

  return {
    eventId: event.eventId,
    deviceId: event.deviceId,
    resourceKind: event.resourceKind,
    resourceKey: event.resourceKey,
    resourceTitle: event.resourceTitle,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    source: event.source,
  };
}

export function parseNdjsonLine(line: string): ActivityEvent {
  const payload = JSON.parse(line) as unknown;
  const event = toActivityEvent(payload);
  const validation = validateActivityEvent(event);

  if (!validation.valid) {
    throw new Error(`Invalid activity event: ${validation.issues.map((x) => x.message).join(', ')}`);
  }

  return event;
}

export interface MergeEventsResult {
  merged: ActivityEvent[];
  duplicates: number;
  invalid: number;
}

export function mergeEventBatches(batches: ActivityEvent[][]): MergeEventsResult {
  const byId = new Map<string, ActivityEvent>();
  let duplicates = 0;
  let invalid = 0;

  for (const batch of batches) {
    for (const event of batch) {
      const validation = validateActivityEvent(event);
      if (!validation.valid) {
        invalid += 1;
        continue;
      }

      if (byId.has(event.eventId)) {
        duplicates += 1;
        continue;
      }

      byId.set(event.eventId, event);
    }
  }

  const merged = [...byId.values()].sort((a, b) => {
    if (a.startedAt !== b.startedAt) {
      return a.startedAt - b.startedAt;
    }

    if (a.endedAt !== b.endedAt) {
      return a.endedAt - b.endedAt;
    }

    return a.eventId.localeCompare(b.eventId);
  });

  return { merged, duplicates, invalid };
}
