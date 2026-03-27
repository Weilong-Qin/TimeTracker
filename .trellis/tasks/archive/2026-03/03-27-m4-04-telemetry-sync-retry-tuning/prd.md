# M4-04: Telemetry-driven sync and retry tuning

## Goal
Use runtime telemetry to adapt sync interval and retry policy for better reliability under real-world network variance.

## Requirements
- Capture sync/push runtime telemetry in desktop local storage (success/failure, retries, duration, timestamps).
- Derive adaptive retry policy profiles from recent telemetry windows.
- Derive effective sync interval from recent sync telemetry (cooldown under repeated failures).
- Keep baseline behavior compatible when telemetry is insufficient.

## Acceptance Criteria
- [x] Sync and push attempts append telemetry entries with bounded retention.
- [x] Retry policy is tuned dynamically from telemetry and applied at runtime.
- [x] Sync interval enters cooldown under repeated failures and recovers under stable success.
- [x] New telemetry module has deterministic unit tests.
- [x] Workspace lint/typecheck/test pass.

## Technical Notes
- Milestone: M4-04
- Planned date: 2026-03-27
- Deferred item addressed: production telemetry-driven tuning of sync intervals and retry strategy.
- Out of scope: remote telemetry upload, cross-device telemetry aggregation, UI dashboards.
- Implemented:
  - Added `apps/desktop/src/lib/sync-telemetry.ts` with telemetry parsing, retention, summary, retry tuning, and interval tuning.
  - Added sync telemetry storage key in `apps/desktop/src/storage/persistence.ts`.
  - Integrated telemetry capture and tuned policies into `apps/desktop/src/hooks/use-activity-model.ts` (`runSyncNow` / `pushReportNow` + timer interval).
  - Added deterministic unit tests in `apps/desktop/test/sync-telemetry.test.ts`.
- Verification:
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Architecture note: `docs/architecture/m4-telemetry-sync-retry-tuning.md`
