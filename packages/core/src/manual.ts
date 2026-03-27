import type { ActivityEvent } from './types.js';

export interface ManualEntryInput {
  eventId: string;
  deviceId: string;
  title: string;
  startAt: number;
  endAt: number;
  tags?: string[];
}

export function createManualEntry(input: ManualEntryInput): ActivityEvent {
  if (input.endAt <= input.startAt) {
    throw new Error('endAt must be greater than startAt');
  }

  return {
    eventId: input.eventId,
    deviceId: input.deviceId,
    resourceKind: 'manual',
    resourceKey: `manual://${input.title.toLowerCase().replace(/\s+/g, '-')}`,
    resourceTitle: input.title,
    startedAt: input.startAt,
    endedAt: input.endAt,
    source: 'manual',
  };
}
