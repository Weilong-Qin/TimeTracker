# Component Guidelines

> These rules apply to existing React components in both `apps/desktop` and `apps/mobile`.

## Mandatory Rules

1. Use semantic HTML elements first (`button`, `label`, `form`, `main`, `nav`).
2. If non-semantic interaction is required, add keyboard and ARIA parity.
3. Do not use `prompt`, `alert`, or `confirm` in app flows.
4. Keep components focused: rendering + local interaction, not cross-layer orchestration.

## Concrete References In This Repo

- Desktop panel/form composition: `apps/desktop/src/App.tsx`
- Mobile timeline/inbox cards: `apps/mobile/src/App.tsx`
- Dialog/browser API restrictions: `.trellis/spec/frontend/electron-browser-api-restrictions.md`
- React state pitfalls: `.trellis/spec/frontend/react-pitfalls.md`

## First-Component Checklist

- [ ] Accessible name and keyboard interaction verified
- [ ] No inline business/data-layer logic
- [ ] Loading/empty/error states are explicit
- [ ] Uses shared contracts/types for cross-layer data

## Anti-Patterns To Avoid

- Clickable `div` without keyboard handlers.
- Calling preload or IPC APIs directly from deep presentational children.
- Combining list rendering, mutation calls, and layout shell logic in one large component.
