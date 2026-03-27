# M4-01: Reliability retry queue and backoff

## Goal
Implement retry-queue style execution with exponential backoff for sync and report push flows.

## Requirements
- Add configurable retry policy support for `@timetracker/sync-r2` sync operations.
- Add configurable retry policy support for `@timetracker/reporting` push operations.
- Preserve backward compatibility for existing call sites while exposing retry-enabled APIs.
- Provide deterministic tests for transient failure recovery and max-attempt exhaustion.

## Acceptance Criteria
- [x] Sync retry API retries transient failures with exponential backoff and eventually succeeds when downstream recovers.
- [x] Sync retry API returns clear failure after max attempts and does not hide final error reason.
- [x] Push retry API retries failed push targets independently and reports final success/failure counts.
- [x] Existing non-retry APIs and current desktop behavior remain compatible.
- [x] Affected package tests and workspace typecheck pass.

## Technical Notes
- Milestone: M4-01
- Planned date: 2026-03-27
- Scope: deferred reliability items from PR3/PR4 (`retry queue and exponential backoff`).
- Out of scope in this slice: scheduled report jobs, rich-card payloads, end-to-end encryption.
- Architecture note: `docs/architecture/m4-reliability-retry-backoff.md`
- Implemented:
  - Added reusable retry/backoff runtimes in `packages/sync-r2/src/retry.ts` and `packages/reporting/src/retry.ts`.
  - Added `syncDayWithRetry` / `syncDayBundleWithRetry` in `@timetracker/sync-r2`.
  - Added `pushReportWithRetry` in `@timetracker/reporting` with per-target independent retry.
  - Wired desktop runtime to retry-enabled APIs in `apps/desktop/src/hooks/use-activity-model.ts`.
  - Added deterministic retry tests in `packages/sync-r2/test/sync-bundle.test.ts` and `packages/reporting/test/offline-reporting.test.ts`.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm --filter @timetracker/reporting test`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
