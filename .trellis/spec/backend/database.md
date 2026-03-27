# Data Persistence Guidelines (Current Repository)

> There is no SQL/ORM database in this repo yet. Persistence is file-based under `.trellis/`.

## Source of Truth Files

| Data | Location | Writer |
| --- | --- | --- |
| Developer identity | `.trellis/.developer` | `common/developer.py` |
| Current task pointer | `.trellis/.current-task` | `common/paths.py` helpers |
| Task metadata | `.trellis/tasks/<task>/task.json` | `scripts/task.py` |
| Task requirements | `.trellis/tasks/<task>/prd.md` | task workflow/manual edits |
| Session journals | `.trellis/workspace/<dev>/journal-*.md` | `scripts/add_session.py` |
| Workspace index | `.trellis/workspace/<dev>/index.md` | `scripts/add_session.py` |

## Persistence Rules

1. Use `pathlib.Path` and repo-root helpers from `common.paths`.
2. Always read/write text with `encoding="utf-8"`.
3. Keep writes atomic at function level (build full content, then write once).
4. For JSON, prefer helper wrappers that return explicit success/failure.

## Real Examples

### 1) JSON read/write wrapper

- File: `.trellis/scripts/task.py`
- Functions: `_read_json_file`, `_write_json_file`
- Pattern: parse failure returns `None`; write returns `True/False`.

### 2) Bootstrap writes with explicit failure handling

- File: `.trellis/scripts/common/developer.py`
- Pattern: create `.developer`, workspace directories, and starter markdown files with per-step `try/except`.

### 3) Large markdown update with deterministic sections

- File: `.trellis/scripts/add_session.py`
- Pattern: read existing `index.md`, rewrite marker sections, then write full updated content.

## Future Migration Note

If this repository adds a runtime database later, keep file-backed task/workspace metadata stable unless there is a documented migration path.

## Anti-Patterns To Avoid

- Partial writes with interleaved file updates and no rollback strategy.
- Mixing relative string paths and `Path` objects in the same code path.
- Silent parse failures that hide corrupt state without surfacing any signal.
