import type { SyncReportArtifact } from '@timetracker/sync-r2';

export interface StoredReportArtifactsPayload {
  schemaVersion: number;
  reports: Record<string, SyncReportArtifact>;
}

export interface UpsertReportArtifactInput {
  periodType: SyncReportArtifact['periodType'];
  periodKey: string;
  content: string;
  source: SyncReportArtifact['source'];
  updatedAt: number;
  updatedByDeviceId: string;
}

export interface ReportHistoryItem {
  reportId: string;
  periodType: SyncReportArtifact['periodType'];
  periodKey: string;
  source: SyncReportArtifact['source'];
  updatedAt: number;
  generatedAt: number;
  preview: string;
}

export const REPORT_ARTIFACTS_SCHEMA_VERSION = 1;

function isReportPeriodType(value: unknown): value is SyncReportArtifact['periodType'] {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function isReportSource(value: unknown): value is SyncReportArtifact['source'] {
  return value === 'ai' || value === 'fallback' || value === 'manual';
}

function toSyncReportArtifact(value: unknown): SyncReportArtifact | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (
    !isReportPeriodType(payload.periodType) ||
    typeof payload.periodKey !== 'string' ||
    typeof payload.generatedAt !== 'number' ||
    !Number.isFinite(payload.generatedAt) ||
    typeof payload.updatedAt !== 'number' ||
    !Number.isFinite(payload.updatedAt) ||
    typeof payload.updatedByDeviceId !== 'string' ||
    !isReportSource(payload.source) ||
    typeof payload.content !== 'string'
  ) {
    return null;
  }

  return {
    periodType: payload.periodType,
    periodKey: payload.periodKey,
    generatedAt: payload.generatedAt,
    updatedAt: payload.updatedAt,
    updatedByDeviceId: payload.updatedByDeviceId,
    source: payload.source,
    content: payload.content,
  };
}

export function buildReportArtifactId(
  periodType: SyncReportArtifact['periodType'],
  periodKey: string,
): string {
  return `${periodType}:${periodKey}`;
}

export function parseReportArtifactId(
  reportId: string,
): { periodType: SyncReportArtifact['periodType']; periodKey: string } | null {
  const match = reportId.match(/^(daily|weekly|monthly):(.+)$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    periodType: match[1] as SyncReportArtifact['periodType'],
    periodKey: match[2],
  };
}

export function parseStoredReportArtifacts(raw: string | null): Map<string, SyncReportArtifact> {
  if (!raw) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredReportArtifactsPayload>;
    if (
      parsed.schemaVersion !== REPORT_ARTIFACTS_SCHEMA_VERSION ||
      typeof parsed.reports !== 'object' ||
      parsed.reports === null
    ) {
      return new Map();
    }

    const reports = new Map<string, SyncReportArtifact>();
    for (const [reportId, value] of Object.entries(parsed.reports)) {
      const artifact = toSyncReportArtifact(value);
      if (!artifact) {
        continue;
      }
      reports.set(reportId, artifact);
    }

    return reports;
  } catch {
    return new Map();
  }
}

export function stringifyStoredReportArtifacts(reports: ReadonlyMap<string, SyncReportArtifact>): string {
  const payload: StoredReportArtifactsPayload = {
    schemaVersion: REPORT_ARTIFACTS_SCHEMA_VERSION,
    reports: Object.fromEntries(reports.entries()),
  };
  return JSON.stringify(payload);
}

export function upsertReportArtifact(
  current: ReadonlyMap<string, SyncReportArtifact>,
  input: UpsertReportArtifactInput,
): Map<string, SyncReportArtifact> {
  const next = new Map(current);
  const reportId = buildReportArtifactId(input.periodType, input.periodKey);

  if (!input.content.trim()) {
    next.delete(reportId);
    return next;
  }

  const existing = next.get(reportId);
  next.set(reportId, {
    periodType: input.periodType,
    periodKey: input.periodKey,
    generatedAt: existing?.generatedAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    updatedByDeviceId: input.updatedByDeviceId,
    source: input.source,
    content: input.content,
  });

  return next;
}

function toPreview(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '(empty report)';
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function listRecentReportHistory(
  reports: ReadonlyMap<string, SyncReportArtifact>,
  limit = 20,
): ReportHistoryItem[] {
  return [...reports.entries()]
    .map(([reportId, report]) => ({
      reportId,
      periodType: report.periodType,
      periodKey: report.periodKey,
      source: report.source,
      updatedAt: report.updatedAt,
      generatedAt: report.generatedAt,
      preview: toPreview(report.content),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.reportId.localeCompare(a.reportId))
    .slice(0, Math.max(1, limit));
}

export function selectReportsForDay(
  day: string,
  reports: ReadonlyMap<string, SyncReportArtifact>,
): Map<string, SyncReportArtifact> {
  const reportId = buildReportArtifactId('daily', day);
  const report = reports.get(reportId);
  if (!report) {
    return new Map();
  }

  return new Map([[reportId, report]]);
}
