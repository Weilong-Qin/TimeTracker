# Frontend Development Guidelines Index (Current Repository)

> **Current status**: No Electron renderer/frontend source code exists in this repository yet.

## Reality Check

The `frontend/` docs currently serve as a curated starter contract for future UI work.
Until a real `src/renderer` (or equivalent) exists, these files are guidance and review checklists, not reflections of existing runtime code.

## Documentation Files

| File | Purpose | Status |
| --- | --- | --- |
| [directory-structure.md](./directory-structure.md) | Expected frontend folder strategy when UI code is added | Active |
| [components.md](./components.md) | Component accessibility and interaction rules | Active |
| [hooks.md](./hooks.md) | Hook design and data-fetching rules | Active |
| [state-management.md](./state-management.md) | State ownership boundaries | Active |
| [type-safety.md](./type-safety.md) | TypeScript strictness and shared-type contracts | Active |
| [quality.md](./quality.md) | Pre-delivery quality checklist | Active |
| [ipc-electron.md](./ipc-electron.md) | IPC patterns for future Electron renderer code | Template |
| [electron-browser-api-restrictions.md](./electron-browser-api-restrictions.md) | Browser API restrictions in Electron | Template |
| [react-pitfalls.md](./react-pitfalls.md) | Known React pitfalls and safe patterns | Template |
| [css-design.md](./css-design.md) | CSS architecture and tokens | Template |

## Core Rules (When Frontend Starts)

1. Keep frontend code in a dedicated renderer subtree and avoid cross-layer leakage.
2. Use shared contract types/constants instead of duplicating payload definitions.
3. Avoid browser APIs that are blocked or unsafe in Electron (`prompt/alert/confirm`, direct Node access).
4. Enforce lint + typecheck before merging UI changes.

## Concrete Reference Assets In This Repo

- Frontend directory contract: `.trellis/spec/frontend/directory-structure.md`
- Accessibility/component behavior examples: `.trellis/spec/frontend/components.md`
- Hook anti-pattern examples: `.trellis/spec/frontend/react-pitfalls.md`
- Browser API constraints: `.trellis/spec/frontend/electron-browser-api-restrictions.md`

## Required Update Trigger

As soon as real frontend code is added, replace template examples with file-backed examples from that implementation.
