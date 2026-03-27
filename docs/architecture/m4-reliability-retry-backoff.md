# M4-01 Reliability Retry and Backoff

## Goal

Close deferred reliability gaps by adding retry execution with exponential backoff for sync and report push flows.

## Scope Delivered

- Added reusable retry runtime to `@timetracker/sync-r2` and `@timetracker/reporting`.
- Added retry-enabled sync APIs:
  - `syncDayWithRetry(...)`
  - `syncDayBundleWithRetry(...)`
- Added retry-enabled report push API:
  - `pushReportWithRetry(...)`
- Wired desktop runtime to retry-enabled APIs with conservative defaults.

## Retry Contract

Retry policy fields:

- `maxRetries`
- `baseDelayMs`
- `maxDelayMs`
- `backoffMultiplier`

Behavior:

- Total attempts = `maxRetries + 1`.
- Delay grows exponentially and is capped by `maxDelayMs`.
- Final failure preserves the last error reason.
- Sleep function is injectable for deterministic tests.

## Desktop Runtime Integration

- Sync path (`runSyncNow`) now uses `syncDayBundleWithRetry`.
- Push path (`pushReportNow`) now uses `pushReportWithRetry`.
- Retry defaults prioritize fast recovery without long UI blocking:
  - Sync: retries 2, `500ms -> 1000ms`
  - Push: retries 2, `800ms -> 1600ms`

## Verification

- `pnpm --filter @timetracker/sync-r2 test`
- `pnpm --filter @timetracker/reporting test`
- `pnpm --filter @timetracker/desktop test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## Remaining Deferred Items

- Scheduled daily/weekly/monthly report jobs.
- Rich card payloads for DingTalk/Feishu.
- Sync payload encryption and object append optimization.
- Long-run soak and telemetry-guided policy tuning.
