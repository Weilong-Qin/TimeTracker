# M4-04 Telemetry-Driven Sync and Retry Tuning

## Goal

Use runtime telemetry to adapt sync interval and retry policy under real network variance.

## Scope Delivered

- Added desktop telemetry model and storage pipeline for sync/push runtime outcomes:
  - success/failure
  - retries used
  - attempt duration
  - timestamps
  - policy snapshot used at execution time
- Added adaptive tuning functions:
  - `tuneRetryPolicyFromTelemetry(...)`
  - `tuneSyncIntervalFromTelemetry(...)`
- Wired tuned policy into runtime execution:
  - sync retry policy now derived from recent sync telemetry
  - push retry policy now derived from recent push telemetry
  - sync timer interval now uses an effective cooldown interval under sustained failure

## Data Path

- Storage key: `timetracker.desktop.sync-telemetry`
- Telemetry source points:
  - `runSyncNow` (sync success/failure)
  - `pushReportNow` (push success/failure)
- Bounded retention:
  - append-only in memory + trim oldest entries by configured cap

## Tuning Strategy

### Retry Tuning Profiles

- `baseline`: default policy (insufficient samples or normal range)
- `resilient`: escalated retries/delays when failure pressure is high
- `lean`: reduced retries/delays when recent runs are stable

### Sync Interval Tuning

- baseline: configured interval from settings
- cooldown: temporarily lift interval (for example to 5/15 minutes) under repeated failures
- recovery: return to configured interval when recent telemetry stabilizes

## Compatibility

- If telemetry is empty or malformed, runtime falls back to baseline settings.
- Existing sync/report flows remain functional without external telemetry services.

## Verification

- `pnpm --filter @timetracker/desktop typecheck`
- `pnpm --filter @timetracker/desktop test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## Out of Scope

- Remote telemetry upload and centralized aggregation.
- Cross-device telemetry federation.
- Dashboard UI for historical telemetry analytics.
