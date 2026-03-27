import { parseNdjsonLine, toNdjsonLine, type ActivityEvent } from '@timetracker/core';

export interface DecodeNdjsonResult {
  events: ActivityEvent[];
  invalidLines: number;
}

export function encodeEventsToNdjson(events: ActivityEvent[]): string {
  return `${events.map((event) => toNdjsonLine(event)).join('\n')}\n`;
}

export function decodeEventsFromNdjson(payload: string): DecodeNdjsonResult {
  const events: ActivityEvent[] = [];
  let invalidLines = 0;

  for (const rawLine of payload.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    try {
      events.push(parseNdjsonLine(line));
    } catch {
      invalidLines += 1;
    }
  }

  return {
    events,
    invalidLines,
  };
}
