import type { ActivityEvent, Annotation, EventSource, ResourceKind } from '@timetracker/core';
import type { MobileShellSnapshot } from './mobile-shell.js';

const RESOURCE_KINDS = new Set<ResourceKind>(['web', 'document', 'project', 'app', 'manual']);
const EVENT_SOURCES = new Set<EventSource>(['auto', 'manual']);

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${context}: expected object`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${context}: expected string`);
  }

  return value;
}

function asFiniteNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${context}: expected finite number`);
  }

  return value;
}

function asStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${context}: expected string array`);
  }

  return value.map((item, index) => asString(item, `${context}[${index}]`).trim()).filter((item) => item.length > 0);
}

function parseEvent(raw: unknown, index: number): ActivityEvent {
  const event = asRecord(raw, `snapshot.events[${index}]`);
  const resourceKind = asString(event.resourceKind, `snapshot.events[${index}].resourceKind`);
  const source = asString(event.source, `snapshot.events[${index}].source`);

  if (!RESOURCE_KINDS.has(resourceKind as ResourceKind)) {
    throw new Error(`Invalid snapshot.events[${index}].resourceKind: ${resourceKind}`);
  }

  if (!EVENT_SOURCES.has(source as EventSource)) {
    throw new Error(`Invalid snapshot.events[${index}].source: ${source}`);
  }

  const parsed: ActivityEvent = {
    eventId: asString(event.eventId, `snapshot.events[${index}].eventId`),
    deviceId: asString(event.deviceId, `snapshot.events[${index}].deviceId`),
    resourceKind: resourceKind as ResourceKind,
    resourceKey: asString(event.resourceKey, `snapshot.events[${index}].resourceKey`),
    startedAt: asFiniteNumber(event.startedAt, `snapshot.events[${index}].startedAt`),
    endedAt: asFiniteNumber(event.endedAt, `snapshot.events[${index}].endedAt`),
    source: source as EventSource,
  };

  if (typeof event.resourceTitle === 'string' && event.resourceTitle.trim().length > 0) {
    parsed.resourceTitle = event.resourceTitle;
  }

  if (parsed.endedAt < parsed.startedAt) {
    throw new Error(`Invalid snapshot.events[${index}]: endedAt must be greater than startedAt`);
  }

  return parsed;
}

function parseAnnotation(raw: unknown, context: string): Annotation {
  const annotation = asRecord(raw, context);
  const parsed: Annotation = {
    tags: asStringArray(annotation.tags, `${context}.tags`),
    updatedAt: asFiniteNumber(annotation.updatedAt, `${context}.updatedAt`),
    updatedByDeviceId: asString(annotation.updatedByDeviceId, `${context}.updatedByDeviceId`),
  };

  if (typeof annotation.primaryCategory === 'string' && annotation.primaryCategory.trim().length > 0) {
    parsed.primaryCategory = annotation.primaryCategory.trim();
  }

  if (typeof annotation.note === 'string' && annotation.note.trim().length > 0) {
    parsed.note = annotation.note.trim();
  }

  return parsed;
}

function parseAnnotationEntry(
  raw: unknown,
  index: number,
): { eventId: string; annotation: Annotation } {
  const entry = asRecord(raw, `snapshot.annotations[${index}]`);

  return {
    eventId: asString(entry.eventId, `snapshot.annotations[${index}].eventId`),
    annotation: parseAnnotation(entry.annotation, `snapshot.annotations[${index}].annotation`),
  };
}

export function parseMobileShellSnapshot(raw: string): MobileShellSnapshot {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(`Invalid snapshot JSON: ${message}`);
  }

  const root = asRecord(parsedJson, 'snapshot');
  const eventsRaw = root.events;
  const annotationsRaw = root.annotations;

  if (!Array.isArray(eventsRaw)) {
    throw new Error('Invalid snapshot.events: expected array');
  }

  if (!Array.isArray(annotationsRaw)) {
    throw new Error('Invalid snapshot.annotations: expected array');
  }

  return {
    events: eventsRaw.map((item, index) => parseEvent(item, index)),
    annotations: annotationsRaw.map((item, index) => parseAnnotationEntry(item, index)),
  };
}

export function stringifyMobileShellSnapshot(snapshot: MobileShellSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
