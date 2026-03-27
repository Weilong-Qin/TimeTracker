# M4-03 Sync End-to-End Payload Encryption

## Goal

Add optional encryption for sync payload objects so remote storage contains encrypted envelopes instead of plaintext activity data.

## Scope Delivered

- Added encryption runtime in `@timetracker/sync-r2`:
  - AES-GCM-256 encryption
  - PBKDF2-SHA256 key derivation from passphrase
  - versioned envelope format with metadata
- Encrypted reads/writes are now supported for all sync channels:
  - events NDJSON shards
  - annotations payloads
  - reports payloads
- Added desktop sync setting field for optional passphrase and wired it into sync execution.

## Envelope Format

Encrypted payloads are stored as:

- Prefix: `ttsync-enc-v1:`
- JSON envelope fields:
  - `version`
  - `algorithm`
  - `kdf`
  - `iterations`
  - `saltHex`
  - `ivHex`
  - `cipherHex`

This enables format detection and future migration without breaking plaintext compatibility.

## Runtime Behavior

- If encryption passphrase is configured:
  - payload is encrypted before `PutObject`
  - payload is decrypted after `GetObject`
- If plaintext payload is encountered:
  - it is processed as before
- If encrypted payload is encountered without passphrase:
  - sync fails with actionable error
- If encrypted payload is encountered with wrong passphrase:
  - sync fails with actionable decrypt error

## Validation

- Added sync regression tests for:
  - encrypted cross-device merge with shared passphrase
  - missing passphrase failure path
  - wrong passphrase failure path
- Verified with:
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Out of Scope

- Key rotation workflow.
- Device bootstrap/trust UX.
- Managed secret storage and recovery.
