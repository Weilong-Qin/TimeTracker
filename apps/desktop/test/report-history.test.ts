import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReportArtifactId,
  listRecentReportHistory,
  parseStoredReportArtifacts,
  selectReportsForDay,
  stringifyStoredReportArtifacts,
  upsertReportArtifact,
} from '../src/lib/report-history.js';
import {
  DESKTOP_STORAGE_KEYS,
  readStoredValue,
  runDesktopStorageMigrations,
  writeStoredValue,
  type BrowserStorage,
} from '../src/storage/persistence.js';
import type { SyncReportArtifact } from '@timetracker/sync-r2';

class MemoryStorage implements BrowserStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('report history persistence: generated and edited report is recoverable after restart-like reload', () => {
  const storage = new MemoryStorage();
  runDesktopStorageMigrations(storage);

  let reports = upsertReportArtifact(
    new Map(),
    {
      periodType: 'daily',
      periodKey: '2026-03-27',
      content: 'initial generated report',
      source: 'ai',
      updatedAt: 100,
      updatedByDeviceId: 'desktop-a',
    },
  );
  reports = upsertReportArtifact(
    reports,
    {
      periodType: 'daily',
      periodKey: '2026-03-27',
      content: 'edited report text',
      source: 'manual',
      updatedAt: 200,
      updatedByDeviceId: 'desktop-a',
    },
  );

  writeStoredValue(
    storage,
    DESKTOP_STORAGE_KEYS.reportArtifacts,
    stringifyStoredReportArtifacts(reports),
  );

  const raw = readStoredValue(storage, DESKTOP_STORAGE_KEYS.reportArtifacts);
  const restored = parseStoredReportArtifacts(raw);
  const report = restored.get(buildReportArtifactId('daily', '2026-03-27'));

  assert.equal(report?.content, 'edited report text');
  assert.equal(report?.source, 'manual');
  assert.equal(report?.generatedAt, 100);
  assert.equal(report?.updatedAt, 200);
});

test('report history retrieval lists recent daily/weekly/monthly artifacts reliably', () => {
  let reports = new Map<string, SyncReportArtifact>();
  reports = upsertReportArtifact(
    reports,
    {
      periodType: 'weekly',
      periodKey: '2026-W13',
      content: 'weekly report',
      source: 'fallback',
      updatedAt: 300,
      updatedByDeviceId: 'desktop-b',
    },
  );
  reports = upsertReportArtifact(
    reports,
    {
      periodType: 'monthly',
      periodKey: '2026-03',
      content: 'monthly report',
      source: 'manual',
      updatedAt: 250,
      updatedByDeviceId: 'desktop-c',
    },
  );
  reports = upsertReportArtifact(
    reports,
    {
      periodType: 'daily',
      periodKey: '2026-03-27',
      content: 'daily report',
      source: 'ai',
      updatedAt: 400,
      updatedByDeviceId: 'desktop-a',
    },
  );

  const history = listRecentReportHistory(reports, 10);

  assert.equal(history.length, 3);
  assert.equal(history[0]?.reportId, 'daily:2026-03-27');
  assert.equal(history[1]?.reportId, 'weekly:2026-W13');
  assert.equal(history[2]?.reportId, 'monthly:2026-03');
  assert.ok(history.every((item) => item.preview.length > 0));

  const daySelection = selectReportsForDay('2026-03-27', reports);
  assert.equal(daySelection.size, 1);
  assert.equal(daySelection.get('daily:2026-03-27')?.content, 'daily report');
});
