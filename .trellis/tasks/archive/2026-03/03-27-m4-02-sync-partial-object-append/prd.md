# M4-02: Sync partial object append optimization

## Goal
Reduce sync write amplification by appending only missing local events instead of rewriting full device-day event snapshots.

## Requirements
- Update `syncDay` event write flow to compute local delta against pulled remote events.
- Write only delta events to new append shard object keys under the day/device prefix.
- Preserve backward compatibility for pulling legacy `YYYY-MM-DD/<device-id>.ndjson` objects.
- Keep `syncDayBundle` behavior compatible via shared `syncDay` path.

## Acceptance Criteria
- [x] Repeated sync with unchanged local events does not create extra event objects.
- [x] Sync with new local events appends only new events and merged result remains correct.
- [x] Existing sync tests continue to pass.
- [x] Workspace typecheck/lint/test pass.

## Technical Notes
- Milestone: M4-02
- Planned date: 2026-03-27
- Deferred item addressed: partial object append optimization from PR3.
- Out of scope: object compaction/GC, encryption, scheduling.
- Implemented:
  - Updated `syncDay` in `packages/sync-r2/src/engine.ts` to run `pull -> delta select -> append shard`.
  - Added event-id based delta selection and append shard key generation.
  - Kept pull compatibility with legacy daily device NDJSON objects.
  - Added regression test in `packages/sync-r2/test/sync-bundle.test.ts` to verify no extra writes on unchanged sync.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm --filter @timetracker/sync-r2 typecheck`
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Architecture note: `docs/architecture/m4-sync-partial-object-append.md`
