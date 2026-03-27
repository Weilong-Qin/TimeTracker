# Logging & Output Guidelines (Current Repository)

> Current scripts use console output (`print`) with clear stream separation.

## Stream Policy

| Stream | Use |
| --- | --- |
| `stdout` | Normal status and command results |
| `stderr` | Errors, warnings, and actionable failures |

## Conventions

1. Use concise, action-oriented messages.
2. Prefix warnings/errors consistently (`[WARN]`, `Error:`).
3. Include minimal context that helps locate the failing operation.
4. Avoid noisy debug output in normal command paths.

## Real Examples

### 1) Structured warning prefix

- File: `.trellis/scripts/task.py`
- Pattern: `_run_hooks` prints `[WARN] Hook failed (...)` and includes stderr from failed hook commands.

### 2) User-facing setup errors

- File: `.trellis/scripts/common/developer.py`
- Pattern: explicit `Error: Failed to ...` messages with exception details to `stderr`.

### 3) Progress-oriented updates

- File: `.trellis/scripts/add_session.py`
- Pattern: prints update progress (`Updating index.md for session ...`) for visibility during file rewrites.

## Future Upgrade Path

If command volume grows, introduce a shared logger wrapper in `scripts/common/` that preserves this stream policy and supports optional debug level.

## Anti-Patterns To Avoid

- Mixing machine-readable output and human logs in the same command path.
- Printing errors to `stdout`.
- Emitting stack traces for expected user mistakes (missing args, missing setup).
