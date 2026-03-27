# Component Guidelines (Bootstrap State)

> No React component files exist yet in this repo. These rules define the minimum bar for first UI components.

## Mandatory Rules

1. Use semantic HTML elements first (`button`, `label`, `form`, `main`, `nav`).
2. If non-semantic interaction is required, add keyboard and ARIA parity.
3. Do not use `prompt`, `alert`, or `confirm` in Electron UI flows.
4. Keep components focused: rendering + local interaction, not cross-layer orchestration.

## Concrete References In This Repo

- Semantic and keyboard-safe interaction examples: `.trellis/spec/frontend/components.md` (this file)
- Dialog replacement rationale: `.trellis/spec/frontend/electron-browser-api-restrictions.md`
- State-preservation pitfalls from conditional rendering: `.trellis/spec/frontend/react-pitfalls.md`

## First-Component Checklist

- [ ] Accessible name and keyboard interaction verified
- [ ] No inline business/data-layer logic
- [ ] Loading/empty/error states are explicit
- [ ] Uses shared constants/types for cross-layer data

## Anti-Patterns To Avoid

- Clickable `div` without keyboard handlers.
- Calling preload or IPC APIs directly from deep presentational children.
- Combining list rendering, mutation calls, and layout shell logic in one large component.
