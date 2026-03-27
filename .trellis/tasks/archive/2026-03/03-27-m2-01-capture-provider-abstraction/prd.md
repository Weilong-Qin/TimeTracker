# M2-01: Capture provider abstraction

## Goal
Introduce capture provider abstraction with real provider and mock fallback.

## Requirements
- Define capture provider contract independent of UI store logic.
- Support runtime selection between real and mock capture implementations.
- Keep downstream event model consistent across providers.

## Acceptance Criteria
- [x] Capture provider interface is stable and documented.
- [x] Real/mock providers are swappable without UI refactor.
- [x] Capture pipeline still emits valid ActivityEvent objects.

## Technical Notes
- Milestone: M2-01
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added capture provider abstraction (`CaptureProvider`) with `browser` and `mock` implementations.
  - Added runtime provider mode resolution (`auto | browser | mock`) and fallback behavior.
  - Integrated provider-based capture loop into `useActivityModel` without changing store APIs.
  - Added provider-specific regression tests for mode parsing, provider selection, and event validity.
  - Added architecture note documenting provider contract and integration.
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
