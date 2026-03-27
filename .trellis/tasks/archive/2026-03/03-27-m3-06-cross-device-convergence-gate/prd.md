# M3-06: Cross-device convergence gate

## Goal
Validate minute-level cross-device convergence for same-day data.

## Requirements
- Define convergence test scenarios across desktop/mobile with sync enabled.
- Measure and verify minute-level eventual consistency targets.
- Record known convergence limits and acceptable variance.

## Acceptance Criteria
- [x] Convergence scenarios have repeatable validation steps.
- [x] Same-day data converges within agreed minute-level window.
- [x] Residual variance is documented and acceptable.

## Technical Notes
- Milestone: M3-06
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Extended `packages/sync-r2/test/sync-bundle.test.ts` with convergence gate scenarios:
    - repeatable cross-device convergence sequence (`desktop -> mobile -> desktop -> mobile`)
    - minute-level convergence window assertion
    - transitional residual variance bound assertion (<= 60,000ms)
    - final-state zero-variance assertion after full convergence rounds
  - Added convergence architecture/gate record: `docs/architecture/m3-cross-device-convergence-gate.md`.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 typecheck`
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
