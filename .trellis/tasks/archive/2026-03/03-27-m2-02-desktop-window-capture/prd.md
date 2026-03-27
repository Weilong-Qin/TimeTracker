# M2-02: Desktop window capture

## Goal
Implement desktop foreground window capture pipeline for real activity tracking.

## Requirements
- Capture foreground app/window metadata on configured interval.
- Map captured window activity into resource-centric events.
- Handle permission or platform API errors gracefully.

## Acceptance Criteria
- [x] Foreground window activity is captured into valid events.
- [x] Capture errors degrade gracefully with diagnostics.
- [x] Collected events are visible in desktop timeline flow.

## Technical Notes
- Milestone: M2-02
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added `window` capture provider with foreground checks (`visibilityState` + `hasFocus`).
  - Mapped window capture outputs to `ActivityEvent` (`resourceKind: app`, stable `window://...` resource key).
  - Added interval configuration read/write via `timetracker.desktop.capture-interval-ms`.
  - Updated auto provider strategy to prefer window capture, then browser, then mock fallback.
  - Added tests for window capture behavior and mode resolution.
  - Added architecture doc for desktop window capture runtime and degradation strategy.
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
