import {
  InMemoryActivityStore,
  applyClassificationRule,
  buildPendingInbox,
  createManualEntry,
  type ActivityStore,
  type ActivityEvent,
  type Annotation,
  type CategorySummary,
  type PendingInboxItem,
} from '@timetracker/core';
import {
  generateAiReport,
  pushReportWithRetry,
  type AiSettings as AiProviderSettings,
  type CategorySnapshot,
  type PushSettings as PushProviderSettings,
  type ResourceSnapshot,
} from '@timetracker/reporting';
import {
  mergeReportArtifacts,
  syncDayBundleWithRetry,
  type SyncReportArtifact,
} from '@timetracker/sync-r2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCaptureProvider,
  parseBrowserBridgeSnapshot,
  resolveCaptureProviderMode,
} from '../capture/provider.js';
import { createInitialSeedEvents } from '../capture/mock-capture.js';
import { toDayString } from '../lib/format.js';
import {
  buildReportArtifactId,
  listRecentReportHistory,
  parseReportArtifactId,
  parseStoredReportArtifacts,
  selectReportsForDay,
  stringifyStoredReportArtifacts,
  type ReportHistoryItem,
  upsertReportArtifact,
} from '../lib/report-history.js';
import {
  appendSyncTelemetry,
  parseSyncTelemetry,
  stringifySyncTelemetry,
  summarizeSyncTelemetry,
  tuneRetryPolicyFromTelemetry,
  tuneSyncIntervalFromTelemetry,
  type SyncTelemetryEntry,
  type RetryPolicySnapshot,
} from '../lib/sync-telemetry.js';
import {
  DESKTOP_STORAGE_KEYS,
  LocalStorageActivityEventRepository,
  LocalStorageAnnotationRepository,
  createDesktopStorage,
  readStoredValue,
  runDesktopStorageMigrations,
  writeStoredValue,
  type BrowserStorage,
} from '../storage/persistence.js';

function resolveDeviceId(storage: BrowserStorage): string {
  const existing = readStoredValue(storage, DESKTOP_STORAGE_KEYS.deviceId);
  if (existing) {
    return existing;
  }

  const generated = `desktop-${crypto.randomUUID().slice(0, 8)}`;
  writeStoredValue(storage, DESKTOP_STORAGE_KEYS.deviceId, generated);
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
  encryptionPassphrase: string;
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

const DEFAULT_CAPTURE_INTERVAL_MS = 15_000;
const MIN_CAPTURE_INTERVAL_MS = 1_000;
const MAX_CAPTURE_INTERVAL_MS = 120_000;

const DEFAULT_SYNC_SETTINGS: SyncSettingsState = {
  enabled: false,
  accountId: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'auto',
  syncIntervalMinutes: 5,
  encryptionPassphrase: '',
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

const BASE_SYNC_RETRY_POLICY: RetryPolicySnapshot = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

const BASE_PUSH_RETRY_POLICY: RetryPolicySnapshot = {
  maxRetries: 2,
  baseDelayMs: 800,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
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
      encryptionPassphrase: typeof parsed.encryptionPassphrase === 'string' ? parsed.encryptionPassphrase : '',
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

function selectAnnotationsForDay(
  dayEvents: ActivityEvent[],
  annotations: ReadonlyMap<string, Annotation>,
): Map<string, Annotation> {
  const dayEventIds = new Set(dayEvents.map((event) => event.eventId));
  const result = new Map<string, Annotation>();

  for (const [eventId, annotation] of annotations.entries()) {
    if (!dayEventIds.has(eventId)) {
      continue;
    }
    result.set(eventId, annotation);
  }

  return result;
}

function toSyncedReportSource(source: 'ai' | 'fallback' | 'disabled'): SyncReportArtifact['source'] {
  if (source === 'ai') {
    return 'ai';
  }

  return 'fallback';
}

function parseBooleanSetting(raw: string | null, fallback = false): boolean {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return fallback;
}

function resolveCaptureIntervalMs(raw: string | null): number {
  if (!raw) {
    return DEFAULT_CAPTURE_INTERVAL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CAPTURE_INTERVAL_MS;
  }

  return Math.min(
    MAX_CAPTURE_INTERVAL_MS,
    Math.max(MIN_CAPTURE_INTERVAL_MS, Math.floor(parsed)),
  );
}

function toReportCategorySnapshots(categories: CategorySummary[]): CategorySnapshot[] {
  return categories.map((item) => ({
    name: item.key,
    durationMs: item.stackedMs,
  }));
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
  categorySummaries: CategorySummary[];
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
  activeReportId: string;
  reportHistory: ReportHistoryItem[];
  openReportHistory: (reportId: string) => void;
  setReportText: (value: string) => void;
  generateReportNow: () => Promise<void>;
  pushReportNow: () => Promise<void>;
  reportStatus: ReportStatus;
}

export function useActivityModel(): ActivityModel {
  const storage = useMemo(() => {
    const next = createDesktopStorage();
    runDesktopStorageMigrations(next);
    return next;
  }, []);
  const captureProviderMode = useMemo(
    () => resolveCaptureProviderMode(readStoredValue(storage, DESKTOP_STORAGE_KEYS.captureProvider)),
    [storage],
  );
  const browserBridgeEnabled = useMemo(
    () =>
      parseBooleanSetting(
        readStoredValue(storage, DESKTOP_STORAGE_KEYS.browserBridgeEnabled),
        false,
      ),
    [storage],
  );
  const captureIntervalMs = useMemo(
    () => resolveCaptureIntervalMs(readStoredValue(storage, DESKTOP_STORAGE_KEYS.captureIntervalMs)),
    [storage],
  );
  const readBrowserBridgeSnapshot = useCallback(() => {
    if (!browserBridgeEnabled) {
      return null;
    }

    return parseBrowserBridgeSnapshot(
      readStoredValue(storage, DESKTOP_STORAGE_KEYS.browserBridgeSnapshot),
    );
  }, [browserBridgeEnabled, storage]);
  const captureProvider = useMemo(
    () =>
      createCaptureProvider({
        mode: captureProviderMode,
        sampleDurationMs: captureIntervalMs,
        getBrowserBridgeSnapshot: readBrowserBridgeSnapshot,
      }),
    [captureIntervalMs, captureProviderMode, readBrowserBridgeSnapshot],
  );
  const storeRef = useRef<ActivityStore | null>(null);
  const syncInFlightRef = useRef(false);
  const reportInFlightRef = useRef(false);
  const pushInFlightRef = useRef(false);

  const [day, setDay] = useState(() => toDayString(Date.now()));
  const [captureRunning, setCaptureRunning] = useState(false);
  const [revision, setRevision] = useState(0);
  const [syncSettings, setSyncSettings] = useState<SyncSettingsState>(() =>
    parseSyncSettings(readStoredValue(storage, DESKTOP_STORAGE_KEYS.syncSettings)),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    lastSyncAt: null,
    message: 'not configured',
  });
  const [syncTelemetryEntries, setSyncTelemetryEntries] = useState<SyncTelemetryEntry[]>(() =>
    parseSyncTelemetry(readStoredValue(storage, DESKTOP_STORAGE_KEYS.syncTelemetry)),
  );
  const [reportSettings, setReportSettings] = useState<AiProviderSettings>(() =>
    parseReportSettings(readStoredValue(storage, DESKTOP_STORAGE_KEYS.reportSettings)),
  );
  const [pushSettings, setPushSettings] = useState<PushProviderSettings>(() =>
    parsePushSettings(readStoredValue(storage, DESKTOP_STORAGE_KEYS.pushSettings)),
  );
  const [reportTextState, setReportTextState] = useState('');
  const [reportArtifacts, setReportArtifacts] = useState<ReadonlyMap<string, SyncReportArtifact>>(() =>
    parseStoredReportArtifacts(readStoredValue(storage, DESKTOP_STORAGE_KEYS.reportArtifacts)),
  );
  const [activeReportId, setActiveReportId] = useState(() => buildReportArtifactId('daily', day));
  const [reportStatus, setReportStatus] = useState<ReportStatus>({
    generating: false,
    pushing: false,
    lastGeneratedAt: null,
    lastPushedAt: null,
    message: 'report idle',
  });

  const deviceId = useMemo(() => resolveDeviceId(storage), [storage]);

  if (!storeRef.current) {
    const store = new InMemoryActivityStore({
      eventRepository: new LocalStorageActivityEventRepository(storage),
      annotationRepository: new LocalStorageAnnotationRepository(storage),
    });

    if (store.getAllEvents().length === 0) {
      store.appendEvents(createInitialSeedEvents(deviceId));
    }

    storeRef.current = store;
  }

  const forceRefresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    writeStoredValue(storage, DESKTOP_STORAGE_KEYS.captureProvider, captureProviderMode);
  }, [captureProviderMode, storage]);

  useEffect(() => {
    writeStoredValue(
      storage,
      DESKTOP_STORAGE_KEYS.browserBridgeEnabled,
      String(browserBridgeEnabled),
    );
  }, [browserBridgeEnabled, storage]);

  useEffect(() => {
    writeStoredValue(storage, DESKTOP_STORAGE_KEYS.captureIntervalMs, String(captureIntervalMs));
  }, [captureIntervalMs, storage]);

  useEffect(() => {
    writeStoredValue(storage, DESKTOP_STORAGE_KEYS.syncSettings, JSON.stringify(syncSettings));
  }, [storage, syncSettings]);

  useEffect(() => {
    writeStoredValue(
      storage,
      DESKTOP_STORAGE_KEYS.syncTelemetry,
      stringifySyncTelemetry(syncTelemetryEntries),
    );
  }, [storage, syncTelemetryEntries]);

  useEffect(() => {
    writeStoredValue(storage, DESKTOP_STORAGE_KEYS.reportSettings, JSON.stringify(reportSettings));
  }, [reportSettings, storage]);

  useEffect(() => {
    writeStoredValue(storage, DESKTOP_STORAGE_KEYS.pushSettings, JSON.stringify(pushSettings));
  }, [pushSettings, storage]);

  useEffect(() => {
    writeStoredValue(
      storage,
      DESKTOP_STORAGE_KEYS.reportArtifacts,
      stringifyStoredReportArtifacts(reportArtifacts),
    );
  }, [reportArtifacts, storage]);

  useEffect(() => {
    const dailyReportId = buildReportArtifactId('daily', day);
    setActiveReportId((current) => (current === dailyReportId ? current : dailyReportId));
  }, [day]);

  useEffect(() => {
    const nextText = reportArtifacts.get(activeReportId)?.content ?? '';
    setReportTextState((current) => (current === nextText ? current : nextText));
  }, [activeReportId, reportArtifacts]);

  useEffect(() => {
    if (!captureRunning) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const event = captureProvider.capture(deviceId, Date.now());
      if (event) {
        storeRef.current?.appendEvents([event]);
      }
      forceRefresh();
    }, captureIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [captureIntervalMs, captureProvider, captureRunning, deviceId, forceRefresh]);

  const events = useMemo(() => storeRef.current?.listEventsForDay(day) ?? [], [day, revision]);
  const annotations = useMemo(() => storeRef.current?.getAnnotations() ?? new Map(), [revision]);
  const pendingInbox = useMemo(() => buildPendingInbox(events, annotations), [events, annotations]);
  const summary = useMemo(() => storeRef.current?.summarizeDay(day), [day, revision]);
  const categorySummaries = useMemo(() => summary?.byPrimaryCategory ?? [], [summary]);
  const categorySnapshots = useMemo(
    () => toReportCategorySnapshots(categorySummaries),
    [categorySummaries],
  );
  const reportHistory = useMemo(() => listRecentReportHistory(reportArtifacts, 24), [reportArtifacts]);
  const syncTelemetrySummary = useMemo(
    () => summarizeSyncTelemetry(syncTelemetryEntries, 'sync'),
    [syncTelemetryEntries],
  );
  const pushTelemetrySummary = useMemo(
    () => summarizeSyncTelemetry(syncTelemetryEntries, 'push'),
    [syncTelemetryEntries],
  );
  const syncRetryTuning = useMemo(
    () => tuneRetryPolicyFromTelemetry(BASE_SYNC_RETRY_POLICY, syncTelemetrySummary),
    [syncTelemetrySummary],
  );
  const pushRetryTuning = useMemo(
    () => tuneRetryPolicyFromTelemetry(BASE_PUSH_RETRY_POLICY, pushTelemetrySummary),
    [pushTelemetrySummary],
  );
  const syncIntervalTuning = useMemo(
    () => tuneSyncIntervalFromTelemetry(syncSettings.syncIntervalMinutes, syncTelemetrySummary),
    [syncSettings.syncIntervalMinutes, syncTelemetrySummary],
  );

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

  const openReportHistory = useCallback((reportId: string) => {
    const parsed = parseReportArtifactId(reportId);
    if (!parsed) {
      return;
    }

    setActiveReportId(reportId);
    if (parsed.periodType === 'daily') {
      setDay(parsed.periodKey);
    }
  }, []);

  const setReportText = useCallback((value: string) => {
    const updatedAt = Date.now();
    setReportTextState(value);
    const parsed = parseReportArtifactId(activeReportId);
    const periodType = parsed?.periodType ?? 'daily';
    const periodKey = parsed?.periodKey ?? day;

    setReportArtifacts((current) =>
      upsertReportArtifact(current, {
        periodType,
        periodKey,
        content: value,
        source: 'manual',
        updatedAt,
        updatedByDeviceId: deviceId,
      }),
    );
  }, [activeReportId, day, deviceId]);

  const runSyncNow = useCallback(async () => {
    if (syncInFlightRef.current) {
      return;
    }

    if (!syncSettings.enabled) {
      setSyncStatus((current) => ({ ...current, message: 'sync disabled' }));
      return;
    }

    const startedAtMs = Date.now();
    let retries = 0;

    syncInFlightRef.current = true;
    setSyncStatus((current) => ({
      ...current,
      syncing: true,
      message: `syncing... (${syncRetryTuning.profile} retry, ${syncIntervalTuning.effectiveIntervalMinutes}m interval)`,
    }));

    try {
      const dayEvents = storeRef.current?.listEventsForDay(day) ?? [];
      const localAnnotations = selectAnnotationsForDay(
        dayEvents,
        storeRef.current?.getAnnotations() ?? new Map(),
      );
      const localReports = selectReportsForDay(day, reportArtifacts);

      const result = await syncDayBundleWithRetry(
        syncSettings,
        day,
        deviceId,
        dayEvents.filter((event) => event.deviceId === deviceId),
        localAnnotations,
        localReports,
        {
          encryption: syncSettings.encryptionPassphrase
            ? {
                passphrase: syncSettings.encryptionPassphrase,
              }
            : undefined,
          retry: {
            policy: syncRetryTuning.policy,
            onRetry: () => {
              retries += 1;
            },
          },
        },
      );

      storeRef.current?.appendEvents(result.mergedEvents);
      storeRef.current?.mergeRemoteAnnotations(result.mergedAnnotations);
      setReportArtifacts((current) => mergeReportArtifacts(current, result.mergedReports));
      forceRefresh();

      const totalObjectsRead =
        result.objectsRead + result.annotationObjectsRead + result.reportObjectsRead;
      const completedAtMs = Date.now();

      setSyncStatus({
        syncing: false,
        lastSyncAt: completedAtMs,
        message:
          `synced ${result.mergedEvents.length} events, ` +
          `${result.mergedAnnotations.size} annotations, ` +
          `${result.mergedReports.size} reports from ${totalObjectsRead} object(s)` +
          ` · policy=${syncRetryTuning.profile}`,
      });
      setSyncTelemetryEntries((current) =>
        appendSyncTelemetry(current, {
          kind: 'sync',
          ok: true,
          startedAtMs,
          endedAtMs: completedAtMs,
          durationMs: completedAtMs - startedAtMs,
          retries,
          policy: syncRetryTuning.policy,
          intervalMinutes: syncIntervalTuning.effectiveIntervalMinutes,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown sync error';
      const completedAtMs = Date.now();
      setSyncStatus({
        syncing: false,
        lastSyncAt: null,
        message,
      });
      setSyncTelemetryEntries((current) =>
        appendSyncTelemetry(current, {
          kind: 'sync',
          ok: false,
          startedAtMs,
          endedAtMs: completedAtMs,
          durationMs: completedAtMs - startedAtMs,
          retries,
          policy: syncRetryTuning.policy,
          intervalMinutes: syncIntervalTuning.effectiveIntervalMinutes,
          errorMessage: message,
        }),
      );
    } finally {
      syncInFlightRef.current = false;
    }
  }, [
    day,
    deviceId,
    forceRefresh,
    reportArtifacts,
    syncIntervalTuning.effectiveIntervalMinutes,
    syncRetryTuning.policy,
    syncRetryTuning.profile,
    syncSettings,
  ]);

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

      const updatedAt = Date.now();
      const dailyReportId = buildReportArtifactId('daily', day);
      setActiveReportId(dailyReportId);
      setReportTextState(result.report);
      setReportArtifacts((current) =>
        upsertReportArtifact(current, {
          periodType: 'daily',
          periodKey: day,
          content: result.report,
          source: toSyncedReportSource(result.source),
          updatedAt,
          updatedByDeviceId: deviceId,
        }),
      );
      setReportStatus((current) => ({
        ...current,
        generating: false,
        lastGeneratedAt: updatedAt,
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
  }, [
    categorySnapshots,
    day,
    deviceId,
    events,
    pendingInbox.length,
    reportSettings,
    summary?.naturalMs,
    summary?.stackedMs,
  ]);

  const pushReportNow = useCallback(async () => {
    if (pushInFlightRef.current) {
      return;
    }

    if (!reportTextState.trim()) {
      setReportStatus((current) => ({
        ...current,
        message: 'report is empty, generate or edit report first',
      }));
      return;
    }

    const startedAtMs = Date.now();
    let retries = 0;

    pushInFlightRef.current = true;
    setReportStatus((current) => ({
      ...current,
      pushing: true,
      message: `pushing report... (${pushRetryTuning.profile} retry)`,
    }));

    try {
      const activePeriod = parseReportArtifactId(activeReportId);
      const periodKey = activePeriod?.periodKey ?? day;
      const pushed = await pushReportWithRetry(
        pushSettings,
        periodKey,
        reportTextState,
        {
          retry: {
            policy: pushRetryTuning.policy,
            onRetry: () => {
              retries += 1;
            },
          },
        },
      );
      const completedAtMs = Date.now();
      setReportStatus((current) => ({
        ...current,
        pushing: false,
        lastPushedAt: pushed.pushed > 0 ? completedAtMs : current.lastPushedAt,
        message: `${pushed.message} · policy=${pushRetryTuning.profile}`,
      }));
      setSyncTelemetryEntries((current) =>
        appendSyncTelemetry(current, {
          kind: 'push',
          ok: pushed.failed === 0,
          startedAtMs,
          endedAtMs: completedAtMs,
          durationMs: completedAtMs - startedAtMs,
          retries,
          policy: pushRetryTuning.policy,
          errorMessage: pushed.failed === 0 ? undefined : pushed.message,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown push error';
      const completedAtMs = Date.now();
      setReportStatus((current) => ({
        ...current,
        pushing: false,
        message,
      }));
      setSyncTelemetryEntries((current) =>
        appendSyncTelemetry(current, {
          kind: 'push',
          ok: false,
          startedAtMs,
          endedAtMs: completedAtMs,
          durationMs: completedAtMs - startedAtMs,
          retries,
          policy: pushRetryTuning.policy,
          errorMessage: message,
        }),
      );
    } finally {
      pushInFlightRef.current = false;
    }
  }, [
    activeReportId,
    day,
    pushRetryTuning.policy,
    pushRetryTuning.profile,
    pushSettings,
    reportTextState,
  ]);

  useEffect(() => {
    if (!syncSettings.enabled) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void runSyncNow();
    }, syncIntervalTuning.effectiveIntervalMinutes * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [runSyncNow, syncIntervalTuning.effectiveIntervalMinutes, syncSettings.enabled]);

  return {
    day,
    setDay,
    deviceId,
    events,
    annotations,
    pendingInbox,
    categorySummaries,
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
    reportText: reportTextState,
    activeReportId,
    reportHistory,
    openReportHistory,
    setReportText,
    generateReportNow,
    pushReportNow,
    reportStatus,
  };
}
