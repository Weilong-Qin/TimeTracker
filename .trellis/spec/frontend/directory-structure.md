# Frontend Directory Structure (Bootstrap State)

> This repository currently has no runtime frontend code. This file defines the expected structure for first implementation.

## Current Reality

Existing frontend-related assets are documentation only:

- `.trellis/spec/frontend/*.md` (guidelines and templates)
- `.trellis/workspace/*` (session journals, not UI code)

## Target Structure When UI Is Added

```text
src/
  main/                # Electron main process
  preload/             # contextBridge and typed renderer API
  renderer/
    src/
      app/             # route/page entry
      components/      # reusable UI components
      features/        # feature-scoped modules
      hooks/           # shared hooks
      styles/          # css/tokens
  shared/
    constants/         # cross-layer constants (IPC channels, enums)
    types/             # shared contracts
```

## Placement Rules

1. Keep UI concerns in `renderer/src/`; do not import Electron main modules directly.
2. Keep cross-layer contracts in `src/shared/`.
3. Keep feature-local UI and hooks grouped by feature before promoting to global folders.
4. Introduce `index.ts` re-export files only when they reduce import noise.

## Real Reference Patterns Available Today

- Layer separation pattern: `.trellis/spec/frontend/ipc-electron.md`
- Shared contract concept: `.trellis/spec/frontend/type-safety.md`
- Current backend modular separation analogue: `.trellis/scripts/common/` vs `.trellis/scripts/*.py`

## Anti-Patterns To Avoid

- Flat renderer directories with unrelated feature code mixed together.
- Defining IPC channel strings in component files.
- Duplicating the same type in multiple layers.
