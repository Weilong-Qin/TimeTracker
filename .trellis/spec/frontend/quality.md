# Frontend Quality Guidelines (Bootstrap State)

> Frontend code is not present yet; this checklist is the merge bar for future UI work.

## Required Checks (When Frontend Exists)

1. `typecheck` passes with zero errors.
2. `lint` passes with zero errors.
3. Changed UI paths are manually verified (empty/loading/error/success flows).
4. No blocked Electron browser APIs (`alert/prompt/confirm`) are introduced.

## Current Repo Smoke Checks

Even before UI code exists, keep docs/scripts healthy:

```bash
python3 ./.trellis/scripts/get_context.py
python3 ./.trellis/scripts/task.py list
```

## Review Focus Areas

- Accessibility and keyboard interaction
- Hook dependency correctness
- Cross-layer contract reuse
- Error visibility to users (no silent failures)

## Concrete References In This Repo

- API restrictions checklist: `.trellis/spec/frontend/electron-browser-api-restrictions.md`
- React pitfalls checklist: `.trellis/spec/frontend/react-pitfalls.md`
- Session workflow quality gate: `.trellis/workflow.md`

## Anti-Patterns To Avoid

- Merging UI code without typecheck/lint evidence.
- Ignoring loading/empty/error states in new views.
- Introducing component-level hardcoded constants already defined in shared modules.
