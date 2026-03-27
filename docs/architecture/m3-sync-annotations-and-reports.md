# M3-03 Sync Annotations and Reports

## Goal

Extend R2 day sync from event-only to bundle sync that also transfers annotations and report artifacts.

## Sync Representation

Per-day, per-device object keys:

- Events: `YYYY-MM-DD/<device-id>.ndjson` (unchanged)
- Annotations: `YYYY-MM-DD/<device-id>.annotations.json`
- Reports: `YYYY-MM-DD/<device-id>.reports.json`

Payload contracts:

- Annotation payload: `{ schemaVersion, annotations: Record<eventId, Annotation> }`
- Report payload: `{ schemaVersion, reports: Record<reportId, SyncReportArtifact> }`

## Merge Semantics

### Events

- Existing idempotent merge via `mergeEventBatches` is unchanged.

### Annotations

- Reuses shared `mergeAnnotations` LWW rule:
  - higher `updatedAt` wins
  - tie-break by `updatedByDeviceId` lexical order

### Reports

- Added `mergeReportArtifacts` with same LWW principle:
  - higher `updatedAt` wins
  - tie-break by `updatedByDeviceId` lexical order

## New Sync API

In `@timetracker/sync-r2` (`packages/sync-r2/src/engine.ts`):

- `pushDayAnnotations(...)`
- `pullDayAnnotations(...)`
- `pushDayReports(...)`
- `pullDayReports(...)`
- `syncDayBundle(...)` (events + annotations + reports)

Backward compatibility:

- Existing `syncDay(...)` behavior remains event-only and unchanged.

## Desktop Integration

`apps/desktop/src/hooks/use-activity-model.ts` now:

1. Maintains local `reportArtifacts` state persisted in `timetracker.desktop.reports`.
2. Calls `syncDayBundle(...)` when sync is enabled.
3. Merges:
  - events -> existing store append
  - annotations -> `store.mergeRemoteAnnotations(...)`
  - reports -> local `reportArtifacts` map via `mergeReportArtifacts(...)`
4. Keeps report editor content aligned with `daily:<day>` artifact.

## Validation

Automated:

- `packages/sync-r2/test/sync-bundle.test.ts`
  - bundle transfer + merge across devices
  - legacy `syncDay` compatibility when new objects exist
  - malformed annotation/report payload tolerance

Regression:

- desktop typecheck/tests
- workspace typecheck/lint/test
