# Optimize Mobile UIUX

## Goal
Improve the mobile app UI/UX for faster daily operation, clearer information hierarchy, and stronger mobile-first ergonomics.

## Requirements
- Reorganize screen flow with mobile-first section navigation to reduce long-scroll friction.
- Prioritize quick capture actions and day overview at top-level.
- Improve visual hierarchy for timeline and pending-inbox cards.
- Improve snapshot area usability with clear status and action separation.
- Preserve existing data model behavior and shared contracts.

## Acceptance Criteria
- [ ] Mobile app has clearer navigation between major sections.
- [ ] Core actions (manual add, classify, annotate) require fewer interactions.
- [ ] Layout and typography are optimized for small screens.
- [ ] Existing mobile tests pass.
- [ ] Mobile typecheck/lint/test pass.

## Technical Notes
- Keep logic in `use-mobile-shell` as single source of truth.
- Focus on UI composition and CSS architecture; avoid behavior regression.
