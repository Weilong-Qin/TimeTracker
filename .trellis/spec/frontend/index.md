# Frontend Development Guidelines Index (Current Repository)

> **Current status**: Runtime frontend code exists in this repository.

## Reality Check

Frontend implementation is currently split by app target:

- `apps/desktop` (React + Vite desktop-oriented UI shell)
- `apps/mobile` (React + Vite mobile-oriented UI shell)

These specs are now both guidance and review checklists over real code paths.

## Documentation Files

| File | Purpose | Status |
| --- | --- | --- |
| [directory-structure.md](./directory-structure.md) | Frontend folder strategy across app targets | Active |
| [components.md](./components.md) | Component accessibility and interaction rules | Active |
| [hooks.md](./hooks.md) | Hook design and state orchestration rules | Active |
| [state-management.md](./state-management.md) | State ownership boundaries | Active |
| [type-safety.md](./type-safety.md) | TypeScript strictness and shared-type contracts | Active |
| [quality.md](./quality.md) | Pre-delivery quality checklist | Active |
| [ipc-electron.md](./ipc-electron.md) | IPC patterns for future Electron renderer code | Template |
| [electron-browser-api-restrictions.md](./electron-browser-api-restrictions.md) | Browser API restrictions in Electron | Template |
| [react-pitfalls.md](./react-pitfalls.md) | Known React pitfalls and safe patterns | Template |
| [css-design.md](./css-design.md) | CSS architecture and tokens | Active |

## Core Rules

1. Keep frontend code isolated per target app (`apps/desktop`, `apps/mobile`) and avoid cross-layer leakage.
2. Use shared contract types/constants instead of duplicating payload definitions.
3. Avoid browser APIs that are blocked or unsafe in Electron/Web contexts (`prompt/alert/confirm`, direct Node access).
4. Enforce lint + typecheck before merging UI changes.

## Concrete Reference Assets In This Repo

- Desktop root component: `apps/desktop/src/App.tsx`
- Desktop hook orchestration: `apps/desktop/src/hooks/use-activity-model.ts`
- Mobile root component: `apps/mobile/src/App.tsx`
- Mobile hook orchestration: `apps/mobile/src/hooks/use-mobile-shell.ts`
- Shared mobile model contract: `apps/mobile/src/model/mobile-shell.ts`

## Required Update Trigger

When a new frontend module, hook pattern, or cross-layer contract is introduced, update this index with file-backed examples.
