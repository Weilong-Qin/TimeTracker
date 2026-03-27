# Error Handling Guidelines (Current Repository)

> Error handling is CLI-first: helpers return status; command boundaries decide exit codes.

## Error Categories

| Category | Typical Action |
| --- | --- |
| User/config precondition missing | Print to `stderr`, `sys.exit(1)` at command boundary |
| Recoverable read/parse failure | Return sentinel (`None`/`False`) and let caller branch |
| Non-critical hook failure | Warn on `stderr`, continue main flow |
| Setup/write failure | Return `False` from helper and report at entrypoint |

## Rules

1. Keep `sys.exit(...)` in top-level command flow, not deep utility functions.
2. Return explicit values for recoverable failures (`None`, `False`).
3. Use `stderr` for errors/warnings; keep normal output on `stdout`.
4. Never swallow exceptions silently in shared utilities.

## Real Examples

### 1) Fail-fast precondition check

- File: `.trellis/scripts/common/developer.py`
- Function: `ensure_developer`
- Pattern: print actionable error + exit when developer identity is missing.

### 2) Recoverable parse failure

- File: `.trellis/scripts/task.py`
- Function: `_read_json_file`
- Pattern: returns `None` on missing/invalid JSON, caller handles fallback.

### 3) Best-effort hook execution

- File: `.trellis/scripts/task.py`
- Function: `_run_hooks`
- Pattern: hook failures emit `[WARN]` to `stderr` but do not crash the primary command.

### 4) Entry-point exit code ownership

- File: `.trellis/scripts/init_developer.py`
- Pattern: branch on return value from `init_developer(...)` and set process exit code in `main()`.

## Anti-Patterns To Avoid

- Calling `sys.exit()` inside low-level helpers that should be reusable.
- Returning success while suppressing a write error.
- Exposing raw traceback text to end users when concise context is enough.
