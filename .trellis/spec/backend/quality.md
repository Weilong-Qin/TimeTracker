# Backend Code Quality Guidelines (Current Repository)

> Quality standards for Python automation code under `.trellis/scripts/`.

## Baseline Standards

1. Use type hints for public functions and non-trivial helpers.
2. Use `from __future__ import annotations` in Python modules.
3. Use `pathlib.Path` and shared path helpers instead of hardcoded path strings.
4. Always use explicit text encoding (`utf-8`) for file IO.
5. Keep command parsing separate from reusable logic.

## Real Examples

### 1) Typed helper utilities

- File: `.trellis/scripts/common/paths.py`
- Pattern: typed signatures like `get_repo_root(start_path: Path | None = None) -> Path`.

### 2) CLI boundary separated from logic

- File: `.trellis/scripts/init_developer.py`
- Pattern: `main()` handles args/exit; `common/developer.py` owns workspace bootstrap logic.

### 3) IO encoding discipline

- Files: `.trellis/scripts/task.py`, `.trellis/scripts/add_session.py`, `.trellis/scripts/common/developer.py`
- Pattern: `read_text(..., encoding="utf-8")` / `write_text(..., encoding="utf-8")`.

## Validation Checklist Before Delivery

- [ ] Manual smoke run for affected commands (for example `python3 ./.trellis/scripts/get_context.py`)
- [ ] No duplicated path constants introduced
- [ ] No silent exception swallowing in changed paths
- [ ] Task/workspace files remain under `.trellis/`

## Useful Smoke Commands

```bash
python3 ./.trellis/scripts/get_context.py
python3 ./.trellis/scripts/task.py list
python3 ./.trellis/scripts/get_developer.py
```

## Anti-Patterns To Avoid

- Adding broad `except Exception: pass` blocks.
- Returning ambiguous values (`"ok"`, `0`, empty string) instead of explicit status types.
- Embedding business logic directly in argparse setup or command dispatch blocks.
