import type { PendingInboxItem } from '@timetracker/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  MobileShellModel,
  bootstrapMobileShell,
  toDayString,
  type MobileAnnotationDraftInput,
  type MobileManualEntryInput,
  type MobileShellView,
} from '../model/mobile-shell.js';
import {
  parseMobileShellSnapshot,
  stringifyMobileShellSnapshot,
} from '../model/snapshot.js';

function parseTagsRaw(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveLatestDayFromView(view: MobileShellView, fallbackDay: string): string {
  const latestEvent = view.timeline.at(-1);
  if (!latestEvent) {
    return fallbackDay;
  }

  return toDayString(latestEvent.event.endedAt);
}

function resolveLatestDayFromEvents(
  latestEndedAt: number | undefined,
  fallbackDay: string,
): string {
  if (typeof latestEndedAt !== 'number') {
    return fallbackDay;
  }

  return toDayString(latestEndedAt);
}

function createSession() {
  const deviceId = `mobile-${crypto.randomUUID().slice(0, 8)}`;
  return {
    deviceId,
    model: bootstrapMobileShell(deviceId),
  };
}

export interface MobileInboxApplyInput {
  primaryCategory?: string;
  tagsRaw?: string;
  note?: string;
}

export interface MobileImportResult {
  ok: boolean;
  message: string;
}

export interface MobileShellState {
  day: string;
  setDay: (day: string) => void;
  deviceId: string;
  view: MobileShellView;
  addManualEntry: (input: MobileManualEntryInput) => void;
  saveAnnotationDraft: (input: MobileAnnotationDraftInput) => void;
  applyInboxAnnotation: (item: PendingInboxItem, input: MobileInboxApplyInput) => void;
  exportSnapshot: () => string;
  importSnapshot: (raw: string) => MobileImportResult;
}

export function useMobileShell(): MobileShellState {
  const [session] = useState(createSession);
  const modelRef = useRef<MobileShellModel>(session.model);
  const [day, setDay] = useState(() => toDayString(Date.now()));
  const [revision, setRevision] = useState(0);

  const bumpRevision = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const addManualEntry = useCallback((input: MobileManualEntryInput) => {
    modelRef.current.addManualEntryWithAnnotation(input);
    setDay(toDayString(input.endAtMs ?? Date.now()));
    bumpRevision();
  }, [bumpRevision]);

  const saveAnnotationDraft = useCallback((input: MobileAnnotationDraftInput) => {
    modelRef.current.saveAnnotationDraft(input);
    bumpRevision();
  }, [bumpRevision]);

  const applyInboxAnnotation = useCallback((
    item: PendingInboxItem,
    input: MobileInboxApplyInput,
  ) => {
    const now = Date.now();

    for (const eventId of item.eventIds) {
      modelRef.current.saveAnnotationDraft({
        eventId,
        primaryCategory: input.primaryCategory,
        tagsRaw: input.tagsRaw,
        note: input.note,
        updatedAt: now,
      });
    }

    bumpRevision();
  }, [bumpRevision]);

  const exportSnapshot = useCallback(() => {
    return stringifyMobileShellSnapshot(modelRef.current.createSnapshot());
  }, []);

  const importSnapshot = useCallback((raw: string): MobileImportResult => {
    try {
      const snapshot = parseMobileShellSnapshot(raw);
      modelRef.current = MobileShellModel.fromSnapshot(session.deviceId, snapshot);
      const latestEndedAt = snapshot.events.reduce<number | undefined>((max, event) => {
        if (typeof max !== 'number' || event.endedAt > max) {
          return event.endedAt;
        }
        return max;
      }, undefined);
      const nextDay = resolveLatestDayFromEvents(latestEndedAt, day);
      setDay(nextDay);
      const snapshotView = modelRef.current.getView(nextDay);
      setDay(resolveLatestDayFromView(snapshotView, nextDay));
      bumpRevision();

      return {
        ok: true,
        message: `Snapshot imported (${snapshot.events.length} events, ${snapshot.annotations.length} annotations)`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown import error';
      return {
        ok: false,
        message,
      };
    }
  }, [bumpRevision, day, session.deviceId]);

  const view = useMemo(() => modelRef.current.getView(day), [day, revision]);

  return {
    day,
    setDay,
    deviceId: session.deviceId,
    view,
    addManualEntry,
    saveAnnotationDraft,
    applyInboxAnnotation,
    exportSnapshot,
    importSnapshot,
  };
}

export function toTagsRaw(tags: string[]): string {
  return tags.join(', ');
}

export function parseTagDraft(raw: string): string[] {
  return parseTagsRaw(raw);
}
