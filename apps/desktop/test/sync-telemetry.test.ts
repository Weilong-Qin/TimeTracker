import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSyncTelemetry,
  parseSyncTelemetry,
  stringifySyncTelemetry,
  summarizeSyncTelemetry,
  tuneRetryPolicyFromTelemetry,
  tuneSyncIntervalFromTelemetry,
  type RetryPolicySnapshot,
  type SyncTelemetryEntry,
} from '../src/lib/sync-telemetry.js';

const BASE_POLICY: RetryPolicySnapshot = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

function createEntry(input: {
  kind: 'sync' | 'push';
  ok: boolean;
  endedAtMs: number;
  retries?: number;
  durationMs?: number;
}): SyncTelemetryEntry {
  const durationMs = input.durationMs ?? 1000;
  return {
    kind: input.kind,
    ok: input.ok,
    startedAtMs: input.endedAtMs - durationMs,
    endedAtMs: input.endedAtMs,
    durationMs,
    retries: input.retries ?? 0,
    policy: BASE_POLICY,
  };
}

test('sync telemetry parse/stringify roundtrip keeps valid entries', () => {
  const telemetry = [
    createEntry({ kind: 'sync', ok: true, endedAtMs: 10 }),
    createEntry({ kind: 'push', ok: false, endedAtMs: 20, retries: 2 }),
  ];

  const serialized = stringifySyncTelemetry(telemetry);
  const parsed = parseSyncTelemetry(serialized);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.kind, 'sync');
  assert.equal(parsed[1]?.kind, 'push');
  assert.equal(parsed[1]?.retries, 2);
});

test('appendSyncTelemetry enforces bounded retention', () => {
  const entries = [
    createEntry({ kind: 'sync', ok: true, endedAtMs: 1 }),
    createEntry({ kind: 'sync', ok: true, endedAtMs: 2 }),
    createEntry({ kind: 'sync', ok: true, endedAtMs: 3 }),
  ];

  const next = appendSyncTelemetry(entries, createEntry({ kind: 'sync', ok: false, endedAtMs: 4 }), 3);
  assert.equal(next.length, 3);
  assert.equal(next[0]?.endedAtMs, 2);
  assert.equal(next[2]?.endedAtMs, 4);
});

test('tuneRetryPolicyFromTelemetry escalates under high failure pressure', () => {
  const entries = [
    createEntry({ kind: 'sync', ok: true, endedAtMs: 1, retries: 0 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 2, retries: 2 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 3, retries: 2 }),
    createEntry({ kind: 'sync', ok: true, endedAtMs: 4, retries: 1 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 5, retries: 2 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 6, retries: 3 }),
  ];
  const summary = summarizeSyncTelemetry(entries, 'sync');
  const tuned = tuneRetryPolicyFromTelemetry(BASE_POLICY, summary);

  assert.equal(tuned.profile, 'resilient');
  assert.ok(tuned.policy.maxRetries > BASE_POLICY.maxRetries);
  assert.ok(tuned.policy.baseDelayMs >= BASE_POLICY.baseDelayMs);
});

test('tuneRetryPolicyFromTelemetry becomes lean under stable low-error telemetry', () => {
  const entries: SyncTelemetryEntry[] = [];
  for (let index = 0; index < 12; index += 1) {
    entries.push(
      createEntry({
        kind: 'push',
        ok: true,
        endedAtMs: index + 1,
        retries: index % 6 === 0 ? 1 : 0,
      }),
    );
  }

  const summary = summarizeSyncTelemetry(entries, 'push');
  const tuned = tuneRetryPolicyFromTelemetry(BASE_POLICY, summary);

  assert.equal(tuned.profile, 'lean');
  assert.ok(tuned.policy.maxRetries <= BASE_POLICY.maxRetries);
  assert.ok(tuned.policy.baseDelayMs <= BASE_POLICY.baseDelayMs);
});

test('tuneSyncIntervalFromTelemetry enters cooldown and recovers', () => {
  const unstableEntries = [
    createEntry({ kind: 'sync', ok: true, endedAtMs: 1 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 2 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 3 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 4 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 5 }),
    createEntry({ kind: 'sync', ok: false, endedAtMs: 6 }),
  ];
  const unstableSummary = summarizeSyncTelemetry(unstableEntries, 'sync');
  const unstableTuned = tuneSyncIntervalFromTelemetry(1, unstableSummary);

  assert.equal(unstableTuned.cooldown, true);
  assert.equal(unstableTuned.effectiveIntervalMinutes, 15);

  const stableEntries: SyncTelemetryEntry[] = [];
  for (let index = 0; index < 12; index += 1) {
    stableEntries.push(createEntry({ kind: 'sync', ok: true, endedAtMs: 100 + index }));
  }
  const stableSummary = summarizeSyncTelemetry(stableEntries, 'sync');
  const stableTuned = tuneSyncIntervalFromTelemetry(1, stableSummary);

  assert.equal(stableTuned.cooldown, false);
  assert.equal(stableTuned.effectiveIntervalMinutes, 1);
});
