# State Management Guidelines (Bootstrap State)

> No runtime frontend state containers exist yet in this repository.

## State Ownership Rules

1. Keep server/data state in query hooks (or equivalent data layer).
2. Keep UI shell state (drawer open/close, selected tab) in lightweight context.
3. Keep ephemeral local state in component scope.
4. Avoid duplicated sources of truth for the same state.

## Initial Architecture Recommendation

- Feature state: feature-level hooks in `features/<feature>/hooks`
- App-shell state: `AppLayoutContext` (minimal, UI-only)
- Shared contracts: `src/shared/types` and `src/shared/constants`

## Concrete References In This Repo

- State pitfalls and stable object/dependency handling: `.trellis/spec/frontend/react-pitfalls.md`
- Hook-level data ownership pattern: `.trellis/spec/frontend/hooks.md`
- Existing non-UI single-source-of-truth analogue: task metadata in `.trellis/tasks/*/task.json`

## Anti-Patterns To Avoid

- Bidirectional sync effects between two states that mirror each other.
- Storing domain entities in global UI context by default.
- Ad-hoc global mutable modules for state.
