# M1-06 Cold-Start Recovery Check

## Purpose

Define a repeatable validation path for desktop persistence consistency across restart-like cycles.

## How To Run

```bash
pnpm --filter @timetracker/desktop test
```

This runs `apps/desktop/test/cold-start-recovery.test.ts` through a compiled Node test harness.

## Covered Scenarios

### 1) Normal cold-start round trip

Flow:
1. Initialize storage and migration metadata.
2. Record events and annotations.
3. Persist settings payload.
4. Recreate store (simulate close/reopen).
5. Verify timeline ordering, summary aggregates, and persisted settings.

Expected:
- Same day events are present after reopen.
- `naturalMs` and `stackedMs` are stable before/after reopen.
- Primary category summary remains consistent.

### 2) Degraded startup with corrupted payloads

Flow:
1. Seed intentionally corrupted `events`, `annotations`, and `storage.meta`.
2. Run migration bootstrap.
3. Recreate store.
4. Verify quarantine keys are created.
5. Append new event/annotation and reopen again.

Expected:
- Startup does not crash.
- Corrupted payloads are isolated via `*.corrupt.<timestamp>` keys.
- Store stays writable and data remains recoverable after reopening.

## Notes

- This check is deterministic and can be run locally or in CI.
- It validates recovery behavior without requiring UI interaction.
