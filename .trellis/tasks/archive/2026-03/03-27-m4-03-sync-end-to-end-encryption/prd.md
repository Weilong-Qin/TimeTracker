# M4-03: Sync end-to-end payload encryption

## Goal
Add optional end-to-end encryption for sync payload objects so remote storage does not hold plaintext event/annotation/report content.

## Requirements
- Add encryption/decryption support in `@timetracker/sync-r2` for all synced object channels (events, annotations, reports).
- Keep plaintext mode backward compatible when encryption is not configured.
- Use deterministic envelope format with explicit version metadata.
- Provide actionable errors for missing/wrong passphrase when reading encrypted objects.

## Acceptance Criteria
- [x] Sync with passphrase writes encrypted payloads and can be pulled/merged with same passphrase.
- [x] Pulling encrypted objects without passphrase fails with clear error.
- [x] Pulling encrypted objects with wrong passphrase fails with clear error.
- [x] Existing plaintext sync behavior and tests remain compatible.
- [x] Workspace typecheck/lint/test pass.

## Technical Notes
- Milestone: M4-03
- Planned date: 2026-03-27
- Deferred item addressed: end-to-end encryption for synced payloads.
- Out of scope: key management UI/rotation, device trust bootstrap.
- Implemented:
  - Added `packages/sync-r2/src/crypto.ts` with AES-GCM + PBKDF2 envelope encryption/decryption.
  - Extended sync execution options with optional `encryption.passphrase`.
  - Wired encryption/decryption into all sync payload channels in `packages/sync-r2/src/engine.ts`.
  - Added desktop optional passphrase setting and sync runtime pass-through in `apps/desktop/src/hooks/use-activity-model.ts`.
  - Added desktop settings input in `apps/desktop/src/App.tsx`.
  - Added encryption regression tests in `packages/sync-r2/test/sync-bundle.test.ts`.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Architecture note: `docs/architecture/m4-sync-end-to-end-encryption.md`
