# Frontend Directory Structure

> This repository contains runtime frontend code for both desktop and mobile app targets.

## Current Reality

Current frontend source layout:

```text
apps/
  desktop/
    src/
      App.tsx
      hooks/
      styles.css
      ...
  mobile/
    src/
      App.tsx
      hooks/
      model/
      styles.css
      ...
```

## Target Structure (Per App)

```text
apps/<target>/src/
  App.tsx              # app-level composition
  hooks/               # state orchestration hooks
  model/               # target-specific view model helpers (if needed)
  lib/                 # formatting/util helpers
  styles.css           # target-level styles entry
```

## Placement Rules

1. Keep UI concerns inside `apps/<target>/src/`; do not import backend process modules directly.
2. Keep cross-layer contracts in shared workspace packages (for example `@timetracker/core`).
3. Keep feature-local UI and hooks grouped by feature before promoting to global folders.
4. Introduce `index.ts` re-export files only when they reduce import noise.

## Real Reference Patterns Available Today

- Desktop app shape: `apps/desktop/src/`
- Mobile app shape: `apps/mobile/src/`
- Shared contract consumption: `apps/mobile/src/model/mobile-shell.ts` importing from `@timetracker/core`

## Anti-Patterns To Avoid

- Flat app directories with unrelated feature code mixed together.
- Defining IPC channel strings in component files.
- Duplicating the same type in multiple layers.
