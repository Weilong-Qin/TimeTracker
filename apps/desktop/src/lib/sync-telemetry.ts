export type TelemetryKind = 'sync' | 'push';
export type TuningProfile = 'baseline' | 'resilient' | 'lean';

export interface RetryPolicySnapshot {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface SyncTelemetryEntry {
  kind: TelemetryKind;
  ok: boolean;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  retries: number;
  policy: RetryPolicySnapshot;
  intervalMinutes?: 1 | 5 | 15 | 30 | 60;
  errorMessage?: string;
}

export interface SyncTelemetrySummary {
  kind: TelemetryKind;
  total: number;
  success: number;
  failed: number;
  failureRate: number;
  avgDurationMs: number;
  avgRetries: number;
  recentFailureStreak: number;
}

export interface RetryPolicyTuningDecision {
  policy: RetryPolicySnapshot;
  profile: TuningProfile;
  reason: string;
}

export interface SyncIntervalTuningDecision {
  effectiveIntervalMinutes: 1 | 5 | 15 | 30 | 60;
  cooldown: boolean;
  reason: string;
}

interface SyncTelemetryPayload {
  schemaVersion: number;
  entries: SyncTelemetryEntry[];
}

const SYNC_TELEMETRY_SCHEMA_VERSION = 1;
const DEFAULT_RETENTION_LIMIT = 120;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTelemetryKind(value: unknown): value is TelemetryKind {
  return value === 'sync' || value === 'push';
}

function normalizePolicy(value: unknown): RetryPolicySnapshot | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (
    !isFiniteNumber(raw.maxRetries) ||
    !isFiniteNumber(raw.baseDelayMs) ||
    !isFiniteNumber(raw.maxDelayMs) ||
    !isFiniteNumber(raw.backoffMultiplier)
  ) {
    return null;
  }

  return {
    maxRetries: Math.max(0, Math.floor(raw.maxRetries)),
    baseDelayMs: Math.max(1, Math.floor(raw.baseDelayMs)),
    maxDelayMs: Math.max(1, Math.floor(raw.maxDelayMs)),
    backoffMultiplier: Math.max(1, raw.backoffMultiplier),
  };
}

function normalizeInterval(value: unknown): 1 | 5 | 15 | 30 | 60 | undefined {
  if (value === 1 || value === 5 || value === 15 || value === 30 || value === 60) {
    return value;
  }
  return undefined;
}

function toTelemetryEntry(value: unknown): SyncTelemetryEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const policy = normalizePolicy(raw.policy);
  if (
    !isTelemetryKind(raw.kind) ||
    typeof raw.ok !== 'boolean' ||
    !isFiniteNumber(raw.startedAtMs) ||
    !isFiniteNumber(raw.endedAtMs) ||
    !isFiniteNumber(raw.durationMs) ||
    !isFiniteNumber(raw.retries) ||
    !policy
  ) {
    return null;
  }

  return {
    kind: raw.kind,
    ok: raw.ok,
    startedAtMs: raw.startedAtMs,
    endedAtMs: raw.endedAtMs,
    durationMs: Math.max(0, Math.floor(raw.durationMs)),
    retries: Math.max(0, Math.floor(raw.retries)),
    policy,
    intervalMinutes: normalizeInterval(raw.intervalMinutes),
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined,
  };
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampIntervalToAllowed(value: number): 1 | 5 | 15 | 30 | 60 {
  if (value <= 1) {
    return 1;
  }
  if (value <= 5) {
    return 5;
  }
  if (value <= 15) {
    return 15;
  }
  if (value <= 30) {
    return 30;
  }
  return 60;
}

export function parseSyncTelemetry(raw: string | null): SyncTelemetryEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncTelemetryPayload>;
    if (
      parsed.schemaVersion !== SYNC_TELEMETRY_SCHEMA_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      return [];
    }

    return parsed.entries
      .map((entry) => toTelemetryEntry(entry))
      .filter((entry): entry is SyncTelemetryEntry => entry !== null)
      .sort((left, right) => left.endedAtMs - right.endedAtMs);
  } catch {
    return [];
  }
}

export function stringifySyncTelemetry(entries: readonly SyncTelemetryEntry[]): string {
  const payload: SyncTelemetryPayload = {
    schemaVersion: SYNC_TELEMETRY_SCHEMA_VERSION,
    entries: [...entries],
  };
  return JSON.stringify(payload);
}

export function appendSyncTelemetry(
  entries: readonly SyncTelemetryEntry[],
  entry: SyncTelemetryEntry,
  maxEntries = DEFAULT_RETENTION_LIMIT,
): SyncTelemetryEntry[] {
  const bounded = Math.max(1, Math.floor(maxEntries));
  const next = [...entries, entry];
  if (next.length <= bounded) {
    return next;
  }
  return next.slice(next.length - bounded);
}

export function summarizeSyncTelemetry(
  entries: readonly SyncTelemetryEntry[],
  kind: TelemetryKind,
  windowSize = 24,
): SyncTelemetrySummary {
  const size = Math.max(1, Math.floor(windowSize));
  const scoped = entries.filter((entry) => entry.kind === kind).slice(-size);

  if (scoped.length === 0) {
    return {
      kind,
      total: 0,
      success: 0,
      failed: 0,
      failureRate: 0,
      avgDurationMs: 0,
      avgRetries: 0,
      recentFailureStreak: 0,
    };
  }

  let success = 0;
  let failed = 0;
  let durationSum = 0;
  let retriesSum = 0;

  for (const entry of scoped) {
    if (entry.ok) {
      success += 1;
    } else {
      failed += 1;
    }
    durationSum += entry.durationMs;
    retriesSum += entry.retries;
  }

  let recentFailureStreak = 0;
  for (let index = scoped.length - 1; index >= 0; index -= 1) {
    if (scoped[index]?.ok) {
      break;
    }
    recentFailureStreak += 1;
  }

  const total = scoped.length;

  return {
    kind,
    total,
    success,
    failed,
    failureRate: roundTo2(failed / total),
    avgDurationMs: Math.round(durationSum / total),
    avgRetries: roundTo2(retriesSum / total),
    recentFailureStreak,
  };
}

export function tuneRetryPolicyFromTelemetry(
  basePolicy: RetryPolicySnapshot,
  summary: SyncTelemetrySummary,
): RetryPolicyTuningDecision {
  const normalizedBase: RetryPolicySnapshot = {
    maxRetries: Math.max(0, Math.floor(basePolicy.maxRetries)),
    baseDelayMs: Math.max(1, Math.floor(basePolicy.baseDelayMs)),
    maxDelayMs: Math.max(1, Math.floor(basePolicy.maxDelayMs)),
    backoffMultiplier: Math.max(1, basePolicy.backoffMultiplier),
  };

  if (summary.total < 6) {
    return {
      policy: normalizedBase,
      profile: 'baseline',
      reason: 'insufficient telemetry samples',
    };
  }

  if (summary.failureRate >= 0.45 || summary.recentFailureStreak >= 2) {
    const baseDelayMs = Math.min(
      20_000,
      Math.max(normalizedBase.baseDelayMs, Math.round(normalizedBase.baseDelayMs * 1.6)),
    );
    const maxDelayMs = Math.max(
      baseDelayMs,
      Math.min(30_000, Math.round(normalizedBase.maxDelayMs * 1.5)),
    );

    return {
      policy: {
        maxRetries: Math.min(5, normalizedBase.maxRetries + 2),
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier: Math.min(3, Math.max(normalizedBase.backoffMultiplier, 2.2)),
      },
      profile: 'resilient',
      reason: 'high failure pressure in recent telemetry',
    };
  }

  if (summary.total >= 10 && summary.failureRate <= 0.12 && summary.avgRetries <= 0.3) {
    const baseDelayMs = Math.max(200, Math.round(normalizedBase.baseDelayMs * 0.75));
    const maxDelayMs = Math.max(baseDelayMs, Math.round(normalizedBase.maxDelayMs * 0.8));

    return {
      policy: {
        maxRetries: Math.max(1, normalizedBase.maxRetries - 1),
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier: Math.max(1.5, Math.min(normalizedBase.backoffMultiplier, 2)),
      },
      profile: 'lean',
      reason: 'stable success with low retry overhead',
    };
  }

  return {
    policy: normalizedBase,
    profile: 'baseline',
    reason: 'normal telemetry range',
  };
}

export function tuneSyncIntervalFromTelemetry(
  configuredInterval: 1 | 5 | 15 | 30 | 60,
  summary: SyncTelemetrySummary,
): SyncIntervalTuningDecision {
  if (summary.total < 6) {
    return {
      effectiveIntervalMinutes: configuredInterval,
      cooldown: false,
      reason: 'insufficient telemetry samples',
    };
  }

  if (summary.recentFailureStreak >= 3 || summary.failureRate >= 0.45) {
    return {
      effectiveIntervalMinutes: clampIntervalToAllowed(Math.max(configuredInterval, 15)),
      cooldown: true,
      reason: 'cooldown due to repeated sync failures',
    };
  }

  if (summary.failureRate >= 0.3) {
    return {
      effectiveIntervalMinutes: clampIntervalToAllowed(Math.max(configuredInterval, 5)),
      cooldown: true,
      reason: 'temporary throttle from elevated failure rate',
    };
  }

  return {
    effectiveIntervalMinutes: configuredInterval,
    cooldown: false,
    reason: 'stable telemetry, using configured interval',
  };
}
