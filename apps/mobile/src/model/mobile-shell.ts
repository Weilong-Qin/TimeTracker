import {
  InMemoryActivityStore,
  buildPendingInbox,
  createManualEntry,
  type ActivityEvent,
  type Annotation,
  type CategorySummary,
  type PendingInboxItem,
} from '@timetracker/core';

export interface MobileTimelineItem {
  event: ActivityEvent;
  annotation?: Annotation;
}

export interface MobileStatsView {
  day: string;
  stackedMs: number;
  naturalMs: number;
  byPrimaryCategory: CategorySummary[];
  pendingInboxCount: number;
}

export interface MobileShellView {
  day: string;
  timeline: MobileTimelineItem[];
  pendingInbox: PendingInboxItem[];
  stats: MobileStatsView;
}

export interface MobileShellSnapshot {
  events: ActivityEvent[];
  annotations: Array<{
    eventId: string;
    annotation: Annotation;
  }>;
}

export interface MobileManualEntryInput {
  title: string;
  minutes: number;
  endAtMs?: number;
  primaryCategory?: string;
  tagsRaw?: string;
  note?: string;
}

export interface MobileAnnotationDraftInput {
  eventId: string;
  primaryCategory?: string;
  tagsRaw?: string;
  note?: string;
  updatedAt?: number;
  updatedByDeviceId?: string;
}

function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return 1;
  }

  return Math.max(1, Math.floor(minutes));
}

function sanitizeTags(tags: string[]): string[] {
  return tags
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseTagsRaw(raw: string): string[] {
  return sanitizeTags(raw.split(','));
}

export function toDayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function createBootstrapAutoEvent(deviceId: string, nowMs: number): ActivityEvent {
  return {
    eventId: `${deviceId}-auto-${nowMs}`,
    deviceId,
    resourceKind: 'app',
    resourceKey: 'app://mobile-shell',
    resourceTitle: 'Mobile Shell Bootstrap',
    startedAt: nowMs - 20 * 60 * 1000,
    endedAt: nowMs - 5 * 60 * 1000,
    source: 'auto',
  };
}

export class MobileShellModel {
  private readonly deviceId: string;

  private readonly store: InMemoryActivityStore;

  constructor(deviceId: string, store?: InMemoryActivityStore) {
    this.deviceId = deviceId;
    this.store = store ?? new InMemoryActivityStore();
  }

  static fromSnapshot(deviceId: string, snapshot: MobileShellSnapshot): MobileShellModel {
    const model = new MobileShellModel(deviceId);

    model.appendEvents(snapshot.events);
    for (const item of snapshot.annotations) {
      model.store.upsertAnnotation(item.eventId, item.annotation);
    }

    return model;
  }

  addManualEntry(title: string, minutes: number, endAtMs = Date.now()): ActivityEvent {
    const durationMs = clampMinutes(minutes) * 60 * 1000;
    const event = createManualEntry({
      eventId: `${this.deviceId}-manual-${endAtMs}`,
      deviceId: this.deviceId,
      title,
      startAt: endAtMs - durationMs,
      endAt: endAtMs,
    });

    this.store.appendEvents([event]);
    return event;
  }

  addManualEntryWithAnnotation(input: MobileManualEntryInput): MobileTimelineItem {
    const endAtMs = input.endAtMs ?? Date.now();
    const event = this.addManualEntry(input.title, input.minutes, endAtMs);

    const hasAnnotationDraft = Boolean(input.primaryCategory?.trim() || input.tagsRaw?.trim() || input.note?.trim());
    if (!hasAnnotationDraft) {
      return { event };
    }

    const annotation = this.saveAnnotationDraft({
      eventId: event.eventId,
      primaryCategory: input.primaryCategory,
      tagsRaw: input.tagsRaw,
      note: input.note,
      updatedAt: endAtMs,
    });

    return {
      event,
      annotation,
    };
  }

  appendEvents(events: ActivityEvent[]): void {
    this.store.appendEvents(events);
  }

  annotateEvent(eventId: string, primaryCategory: string, tags: string[], updatedAt = Date.now()): Annotation {
    return this.saveAnnotationDraft({
      eventId,
      primaryCategory,
      tagsRaw: tags.join(','),
      updatedAt,
    });
  }

  saveAnnotationDraft(input: MobileAnnotationDraftInput): Annotation {
    const trimmedCategory = input.primaryCategory?.trim();
    const trimmedNote = input.note?.trim();
    const updatedByDeviceId = input.updatedByDeviceId?.trim() || this.deviceId;
    const updatedAt = input.updatedAt ?? Date.now();

    return this.store.upsertAnnotation(input.eventId, {
      primaryCategory: trimmedCategory && trimmedCategory.length > 0 ? trimmedCategory : undefined,
      tags: parseTagsRaw(input.tagsRaw ?? ''),
      note: trimmedNote && trimmedNote.length > 0 ? trimmedNote : undefined,
      updatedAt,
      updatedByDeviceId,
    });
  }

  mergeRemoteAnnotations(incoming: ReadonlyMap<string, Annotation>): void {
    this.store.mergeRemoteAnnotations(incoming);
  }

  getView(day: string): MobileShellView {
    const timelineEvents = this.store.listEventsForDay(day);
    const annotations = this.store.getAnnotations();
    const pendingInbox = buildPendingInbox(timelineEvents, annotations);
    const summary = this.store.summarizeDay(day);

    return {
      day,
      timeline: timelineEvents.map((event) => ({
        event,
        annotation: annotations.get(event.eventId),
      })),
      pendingInbox,
      stats: {
        day,
        stackedMs: summary.stackedMs,
        naturalMs: summary.naturalMs,
        byPrimaryCategory: summary.byPrimaryCategory,
        pendingInboxCount: pendingInbox.length,
      },
    };
  }

  createSnapshot(): MobileShellSnapshot {
    return {
      events: this.store.getAllEvents(),
      annotations: [...this.store.getAnnotations().entries()].map(([eventId, annotation]) => ({
        eventId,
        annotation,
      })),
    };
  }
}

export function bootstrapMobileShell(deviceId: string, nowMs = Date.now()): MobileShellModel {
  const model = new MobileShellModel(deviceId);
  const autoEvent = createBootstrapAutoEvent(deviceId, nowMs);
  model.appendEvents([autoEvent]);
  model.addManualEntryWithAnnotation({
    title: 'Mobile quick note',
    minutes: 10,
    endAtMs: nowMs - 5 * 60 * 1000,
    primaryCategory: 'admin',
    tagsRaw: 'mobile, quick-note',
  });
  model.annotateEvent(autoEvent.eventId, 'work', ['mobile', 'bootstrap'], nowMs);

  return model;
}
