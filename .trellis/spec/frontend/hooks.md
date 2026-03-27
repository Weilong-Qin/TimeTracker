# Hook Guidelines

> Hooks are used as state orchestration boundaries in both desktop and mobile apps.

## Hook Design Rules

1. Name hooks with `use*` and keep return shapes stable.
2. Keep hooks single-purpose (query/mutation/UI concern), then compose.
3. Include all dynamic inputs in dependency lists and cache keys.
4. Expose explicit loading/error states; never hide async failures.

## Recommended Structure

```text
apps/<target>/src/hooks/
  use<Feature>.ts
```

## Concrete References In This Repo

- Desktop orchestration hook: `apps/desktop/src/hooks/use-activity-model.ts`
- Mobile orchestration hook: `apps/mobile/src/hooks/use-mobile-shell.ts`
- Dependency/state pitfalls: `.trellis/spec/frontend/react-pitfalls.md`

## Anti-Patterns To Avoid

- Hook functions that both fetch data and mutate unrelated global state.
- Missing dependencies in `useEffect` / `useCallback`.
- Returning untyped `any` payloads from hooks.
