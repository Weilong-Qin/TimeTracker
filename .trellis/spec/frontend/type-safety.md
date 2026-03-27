# Frontend Type Safety Guidelines (Bootstrap State)

> There is no TypeScript frontend code yet. These rules define required type safety once frontend implementation begins.

## Mandatory Type Rules

1. Enable strict TypeScript mode.
2. Define cross-layer contracts once in shared modules and import them.
3. Avoid `any`; use narrowed unions or `unknown` + validation.
4. Avoid non-null assertions (`!`) unless there is a proven invariant and comment.

## Contract Ownership

- Shared payloads and enums: `src/shared/types/`, `src/shared/constants/`
- Renderer-only view models: `renderer/src/features/*/types.ts`
- IPC channel constants: shared constants only

## Concrete References In This Repo

- Shared-type mindset template: `.trellis/spec/frontend/type-safety.md` (this file)
- Cross-layer contract discipline analogue: `.trellis/scripts/common/paths.py` central constants
- Validation-first pattern inspiration: `.trellis/spec/backend/type-safety.md`

## Anti-Patterns To Avoid

- Redefining the same payload type in preload and renderer.
- Enum values hardcoded in multiple components.
- Implicit `any` return values from data hooks.
