# Hook Guidelines (Bootstrap State)

> No React hooks exist yet in this repo. This file defines required hook patterns for first implementation.

## Hook Design Rules

1. Name hooks with `use*` and keep return shapes stable.
2. Keep hooks single-purpose (query/mutation/UI concern), then compose.
3. Include all dynamic inputs in dependency lists and cache keys.
4. Expose explicit loading/error states; never hide async failures.

## Recommended Structure

```text
renderer/src/
  features/<feature>/hooks/
    use<Feature>Query.ts
    use<Feature>Mutation.ts
    index.ts
```

## Concrete References In This Repo

- Query/mutation pattern template: `.trellis/spec/frontend/hooks.md` (this file)
- Dependency and state pitfalls: `.trellis/spec/frontend/react-pitfalls.md`
- IPC call boundaries: `.trellis/spec/frontend/ipc-electron.md`

## Anti-Patterns To Avoid

- Hook functions that both fetch data and mutate unrelated global state.
- Missing dependencies in `useEffect` / `useCallback`.
- Returning untyped `any` payloads from hooks.
