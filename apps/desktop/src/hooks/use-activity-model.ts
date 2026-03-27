import {
  InMemoryActivityStore,
  applyClassificationRule,
  buildPendingInbox,
  createManualEntry,
  type ActivityEvent,
  type Annotation,
  type PendingInboxItem,
} from '@timetracker/core';
import {
  generateAiReport,
  pushReport,
  type AiSettings as AiProviderSettings,
  type CategorySnapshot,
  type PushSettings as PushProviderSettings,
  type ResourceSnapshot,
} from '@timetracker/reporting';
import { syncDay } from '@timetracker/sync-r2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialSeedEvents, createMockCaptureEvent } from '../capture/mock-capture.js';
import { toDayString } from '../lib/format.js';

function resolveDeviceId(): string {
  const key = 'timetracker.desktop.device-id';
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = `desktop-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, generated);
  return generated;
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

interface SyncSettingsState {
  enabled: boolean;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  syncIntervalMinutes: 1 | 5 | 15 | 30 | 60;
}

interface SyncStatus {
  syncing: boolean;
  lastSyncAt: number | null;
  message: string;
}

interface ReportStatus {
  generating: boolean;
  pushing: boolean;
  lastGeneratedAt: number | null;
  lastPushedAt: number | null;
  message: string;
}

const DEFAULT_SYNC_SETTINGS: SyncSettingsState = {
  enabled: false,
  accountId: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'auto',
  syncIntervalMinutes: 5,
};

const DEFAULT_REPORT_SETTINGS: AiProviderSettings = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/responses',
  apiKey: '',
  model: 'gpt-4.1-mini',
  timeoutMs: 15000,
};

const DEFAULT_PUSH_SETTINGS: PushProviderSettings = {
  webhookEnabled: false,
  webhookUrl: '',
  dingTalkEnabled: false,
  dingTalkWebhookUrl: '',
  feishuEnabled: false,
  feishuWebhookUrl: '',
};

function parseSyncSettings(raw: string | null): SyncSettingsState {
  if (!raw) {
    return DEFAULT_SYNC_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncSettingsState>;
    const interval = parsed.syncIntervalMinutes;
    const normalizedInterval: 1 | 5 | 15 | 30 | 60 =
      interval === 1 || interval === 5 || interval === 15 || interval === 30 || interval === 60
        ? interval
        : 5;

    return {
      enabled: Boolean(parsed.enabled),
      accountId: parsed.accountId ?? '',
      bucket: parsed.bucket ?? '',
      accessKeyId: parsed.accessKeyId ?? '',
      secretAccessKey: parsed.secretAccessKey ?? '',
      region: parsed.region ?? 'auto',
      syncIntervalMinutes: normalizedInterval,
    };
  } catch {
    return DEFAULT_SYNC_SETTINGS;
  }
}

function parseReportSettings(raw: string | null): AiProviderSettings {
  if (!raw) {
    return DEFAULT_REPORT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiProviderSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      endpoint: parsed.endpoint ?? DEFAULT_REPORT_SETTINGS.endpoint,
      apiKey: parsed.apiKey ?? '',
      model: parsed.model ?? DEFAULT_REPORT_SETTINGS.model,
      timeoutMs: typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0 ? parsed.timeoutMs : 15000,
    };
  } catch {
    return DEFAULT_REPORT_SETTINGS;
  }
}

function parsePushSettings(raw: string | null): PushProviderSettings {
  if (!raw) {
    return DEFAULT_PUSH_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PushProviderSettings>;
    return {
      webhookEnabled: Boolean(parsed.webhookEnabled),
      webhookUrl: parsed.webhookUrl ?? '',
      dingTalkEnabled: Boolean(parsed.dingTalkEnabled),
      dingTalkWebhookUrl: parsed.dingTalkWebhookUrl ?? '',
      feishuEnabled: Boolean(parsed.feishuEnabled),
      feishuWebhookUrl: parsed.feishuWebhookUrl ?? '',
    };
  } catch {
    return DEFAULT_PUSH_SETTINGS;
  }
}

function buildCategorySnapshots(
  events: ActivityEvent[],
  annotations: ReadonlyMap<string, Annotation>,
): CategorySnapshot[] {
  const buckets = new Map<string, number>();

  for (const event of events) {
    const category = annotations.get(event.eventId)?.primaryCategory ?? 'uncategorized';
    const duration = Math.max(0, event.endedAt - event.startedAt);
    buckets.set(category, (buckets.get(category) ?? 0) + duration);
  }

  return [...buckets.entries()]
    .map(([name, durationMs]) => ({ name, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs);
}

function buildResourceSnapshots(events: ActivityEvent[]): ResourceSnapshot[] {
  const buckets = new Map<string, ResourceSnapshot>();

  for (const event of events) {
    const key = `${event.resourceKind}:${event.resourceKey}`;
    const duration = Math.max(0, event.endedAt - event.startedAt);
    const current = buckets.get(key);

    if (!current) {
      buckets.set(key, {
        key: event.resourceKey,
        title: event.resourceTitle,
        durationMs: duration,
      });
      continue;
    }

    current.durationMs += duration;
    if (!current.title && event.resourceTitle) {
      current.title = event.resourceTitle;
    }
  }

  return [...buckets.values()].sort((a, b) => b.durationMs - a.durationMs);
}

export interface ActivityModel {
  day: string;
  setDay: (day: string) => void;
  deviceId: string;
  events: ActivityEvent[];
  annotations: ReadonlyMap<string, Annotation>;
  pendingInbox: PendingInboxItem[];
  categorySnapshots: CategorySnapshot[];
  stackedMs: number;
  naturalMs: number;
  captureRunning: boolean;
  startCapture: () => void;
  stopCapture: () => void;
  addManual: (title: string, minutes: number) => void;
  annotateEvent: (eventId: string, primaryCategory: string, tagsRaw: string) => void;
  applyInboxRule: (item: PendingInboxItem, primaryCategory: string, tagsRaw: string) => void;
  syncSettings: SyncSettingsState;
  updateSyncSettings: (patch: Partial<SyncSettingsState>) => void;
  runSyncNow: () => Promise<void>;
  syncStatus: SyncStatus;
  reportSettings: AiProviderSettings;
  updateReportSettings: (patch: Partial<AiProviderSettings>) => void;
  pushSettings: PushProviderSettings;
  updatePushSettings: (patch: Partial<PushProviderSettings>) => void;
  reportText: string;
  setReportText: (value: string) => void;
  generateReportNow: () => Promise<void>;
  pushReportNow: () => Promise<void>;
  reportStatus: ReportStatus;
}

export function useActivityModel(): ActivityModel {
  const storeRef = useRef<InMemoryActivityStore | null>(null);
  const syncInFlightRef = useRef(false);
  const reportInFlightRef = useRef(false);
  const pushInFlightRef = useRef(false);

  const [day, setDay] = useState(() => toDayString(Date.now()));
  const [captureRunning, setCaptureRunning] = useState(false);
  const [revision, setRevision] = useState(0);
  const [syncSettings, setSyncSettings] = useState<SyncSettingsState>(() =>
    parseSyncSettings(window.localStorage.getItem('timetracker.desktop.sync-settings')),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    lastSyncAt: null,
    message: 'not configured',
  });
  const [reportSettings, setReportSettings] = useState<AiProviderSettings>(() =>
    parseReportSettings(window.localStorage.getItem('timetracker.desktop.report-settings')),
  );
  const [pushSettings, setPushSettings] = useState<PushProviderSettings>(() =>
    parsePushSettings(window.localStorage.getItem('timetracker.desktop.push-settings')),
  );
  const [reportText, setReportText] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>({
    generating: false,
    pushing: false,
    lastGeneratedAt: null,
    lastPushedAt: null,
    message: 'report idle',
  });

  const deviceId = useMemo(() => resolveDeviceId(), []);

  if (!storeRef.current) {
    const store = new InMemoryActivityStore();
    store.appendEvents(createInitialSeedEvents(deviceId));
    storeRef.current = store;
  }

  const forceRefresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('timetracker.desktop.sync-settings', JSON.stringify(syncSettings));
  }, [syncSettings]);

  useEffect(() => {
    window.localStorage.setItem('timetracker.desktop.report-settings', JSON.stringify(reportSettings));
  }, [reportSettings]);

  useEffect(() => {
    window.localStorage.setItem('timetracker.desktop.push-settings', JSON.stringify(pushSettings));
  }, [pushSettings]);

  useEffect(() => {
    if (!captureRunning) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const event = createMockCaptureEvent(deviceId);
      storeRef.current?.appendEvents([event]);
      forceRefresh();
    }, 15_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [captureRunning, deviceId, forceRefresh]);

  const events = useMemo(() => storeRef.current?.listEventsForDay(day) ?? [], [day, revision]);
  const annotations = useMemo(() => storeRef.current?.getAnnotations() ?? new Map(), [revision]);
  const pendingInbox = useMemo(() => buildPendingInbox(events, annotations), [events, annotations]);
  const summary = useMemo(() => storeRef.current?.summarizeDay(day), [day, revision]);
  const categorySnapshots = useMemo(() => buildCategorySnapshots(events, annotations), [events, annotations]);

  const addManual = useCallback(
    (title: string, minutes: number) => {
      const durationMs = Math.max(1, minutes) * 60 * 1000;
      const endAt = Date.now();
      const event = createManualEntry({
        eventId: `${deviceId}-manual-${endAt}`,
        deviceId,
        title,
        startAt: endAt - durationMs,
        endAt,
      });

      storeRef.current?.appendEvents([event]);
      forceRefresh();
    },
    [deviceId, forceRefresh],
  );

  const annotateEvent = useCallback(
    (eventId: string, primaryCategory: string, tagsRaw: string) => {
      storeRef.current?.upsertAnnotation(eventId, {
        primaryCategory,
        tags: parseTags(tagsRaw),
        updatedAt: Date.now(),
        updatedByDeviceId: deviceId,
      });

      forceRefresh();
    },
    [deviceId, forceRefresh],
  );

  const applyInboxRule = useCallback(
    (item: PendingInboxItem, primaryCategory: string, tagsRaw: string) => {
      const tags = parseTags(tagsRaw);
      const allEvents = storeRef.current?.getAllEvents() ?? [];
      const now = Date.now();

      const applied = applyClassificationRule(
        {
          id: `${deviceId}-rule-${now}`,
          matcherType: 'resource-key-exact',
          matcherValue: item.resourceKey,
          primaryCategory,
          tags,
        },
        allEvents,
        storeRef.current?.getAnnotations() ?? new Map(),
        now,
        deviceId,
      );

      storeRef.current?.mergeRemoteAnnotations(applied.updatedAnnotations);
      forceRefresh();
    },
    [deviceId, forceRefresh],
  );

  const updateSyncSettings = useCallback((patch: Partial<SyncSettingsState>) => {
    setSyncSettings((current) => ({ ...current, ...patch }));
  }, []);

  const updateReportSettings = useCallback((patch: Partial<AiProviderSettings>) => {
    setReportSettings((current) => ({ ...current, ...patch }));
  }, []);

  const updatePushSettings = useCallback((patch: Partial<PushProviderSettings>) => {
    setPushSettings((current) => ({ ...current, ...patch }));
  }, []);

  const runSyncNow = useCallback(async () => {
    if (syncInFlightRef.current) {
      return;
    }

    if (!syncSettings.enabled) {
      setSyncStatus((current) => ({ ...current, message: 'sync disabled' }));
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus((current) => ({ ...current, syncing: true, message: 'syncing...' }));

    try {
      const dayEvents = storeRef.current?.listEventsForDay(day) ?? [];
      const localDeviceEvents = dayEvents.filter((event) => event.deviceId === deviceId);
      const result = await syncDay(syncSettings, day, deviceId, localDeviceEvents);
      storeRef.current?.appendEvents(result.mergedEvents);
      forceRefresh();

      setSyncStatus({
        syncing: false,
        lastSyncAt: Date.now(),
        message: `synced ${result.mergedEvents.length} events from ${result.objectsRead} object(s)`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown sync error';
      setSyncStatus({
        syncing: false,
        lastSyncAt: null,
        message,
      });
    } finally {
      syncInFlightRef.current = false;
    }
  }, [day, deviceId, forceRefresh, syncSettings]);

  const generateReportNow = useCallback(async () => {
    if (reportInFlightRef.current) {
      return;
    }

    reportInFlightRef.current = true;
    setReportStatus((current) => ({ ...current, generating: true, message: 'generating report...' }));

    try {
      const topResources = buildResourceSnapshots(events).slice(0, 8);
      const result = await generateAiReport(reportSettings, {
        day,
        naturalMs: summary?.naturalMs ?? 0,
        stackedMs: summary?.stackedMs ?? 0,
        pendingInboxCount: pendingInbox.length,
        categories: categorySnapshots.slice(0, 8),
        topResources,
      });

      setReportText(result.report);
      setReportStatus((current) => ({
        ...current,
        generating: false,
        lastGeneratedAt: Date.now(),
        message: result.message,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown report error';
      setReportStatus((current) => ({
        ...current,
        generating: false,
        message,
      }));
    } finally {
      reportInFlightRef.current = false;
    }
  }, [categorySnapshots, day, events, pendingInbox.length, reportSettings, summary?.naturalMs, summary?.stackedMs]);

  const pushReportNow = useCallback(async () => {
    if (pushInFlightRef.current) {
      return;
    }

    if (!reportText.trim()) {
      setReportStatus((current) => ({
        ...current,
        message: 'report is empty, generate or edit report first',
      }));
      return;
    }

    pushInFlightRef.current = true;
    setReportStatus((current) => ({ ...current, pushing: true, message: 'pushing report...' }));

    try {
      const pushed = await pushReport(pushSettings, day, reportText);
      setReportStatus((current) => ({
        ...current,
        pushing: false,
        lastPushedAt: pushed.pushed > 0 ? Date.now() : current.lastPushedAt,
        message: pushed.message,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown push error';
      setReportStatus((current) => ({
        ...current,
        pushing: false,
        message,
      }));
    } finally {
      pushInFlightRef.current = false;
    }
  }, [day, pushSettings, reportText]);

  useEffect(() => {
    if (!syncSettings.enabled) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void runSyncNow();
    }, syncSettings.syncIntervalMinutes * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [runSyncNow, syncSettings.enabled, syncSettings.syncIntervalMinutes]);

  return {
    day,
    setDay,
    deviceId,
    events,
    annotations,
    pendingInbox,
    categorySnapshots,
    stackedMs: summary?.stackedMs ?? 0,
    naturalMs: summary?.naturalMs ?? 0,
    captureRunning,
    startCapture: () => setCaptureRunning(true),
    stopCapture: () => setCaptureRunning(false),
    addManual,
    annotateEvent,
    applyInboxRule,
    syncSettings,
    updateSyncSettings,
    runSyncNow,
    syncStatus,
    reportSettings,
    updateReportSettings,
    pushSettings,
    updatePushSettings,
    reportText,
    setReportText,
    generateReportNow,
    pushReportNow,
    reportStatus,
  };
}
