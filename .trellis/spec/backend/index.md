# Backend Development Guidelines Index (Current Repository)

> **Current stack**: Python 3 CLI scripts + file-based persistence under `.trellis/`.

## Reality Check

This repository does not contain Electron main-process application code yet.
The backend conventions in this folder are based on the existing automation scripts in:

- `.trellis/scripts/`
- `.trellis/scripts/common/`
- `.trellis/scripts/multi_agent/`

When real app backend code is added later, update these docs with those concrete examples.

---

## Documentation Files

| File | Purpose | Status |
| --- | --- | --- |
| [directory-structure.md](./directory-structure.md) | Where backend logic belongs in this repo | Active |
| [database.md](./database.md) | File-based persistence rules (current equivalent of DB rules) | Active |
| [error-handling.md](./error-handling.md) | Error categories, exit-code policy, fail-fast rules | Active |
| [logging.md](./logging.md) | Output/log conventions for CLI scripts | Active |
| [quality.md](./quality.md) | Type safety, import, and verification checklist | Active |
| [api-module.md](./api-module.md) | Future Electron service module template | Template |
| [api-patterns.md](./api-patterns.md) | Future API pattern reference | Template |
| [environment.md](./environment.md) | Future runtime env guidance | Template |
| [pagination.md](./pagination.md) | Future list API pagination guidance | Template |
| [type-safety.md](./type-safety.md) | Future TS/Zod patterns | Template |
| [macos-permissions.md](./macos-permissions.md) | Future macOS permissions reference | Template |
| [text-input.md](./text-input.md) | Future text insertion reference | Template |

---

## Quick Navigation

| Task | Read |
| --- | --- |
| Add a new CLI/task command | [directory-structure.md](./directory-structure.md) |
| Read/write task metadata or journals | [database.md](./database.md) |
| Decide return-vs-exit behavior | [error-handling.md](./error-handling.md) |
| Print diagnostics safely | [logging.md](./logging.md) |
| Run pre-delivery checks | [quality.md](./quality.md) |

---

## Core Rules Summary

| Rule | Why |
| --- | --- |
| Keep CLI entrypoints thin; move reusable logic to `scripts/common/` | Avoid duplicated logic |
| Use `Path` utilities from `common.paths` | Stable path resolution |
| Always specify `encoding="utf-8"` in file IO | Cross-platform correctness |
| Return explicit status (`True/False` or `None`) for recoverable errors | Predictable control flow |
| Use `sys.exit(code)` only at command boundary | Keep helpers reusable/testable |
| Print user-facing errors to `stderr` | Correct CLI semantics |

---

## Concrete Examples In This Repo

- CLI orchestration: `.trellis/scripts/task.py`
- Context output wrapper: `.trellis/scripts/get_context.py`
- Developer bootstrap and workspace setup: `.trellis/scripts/common/developer.py`
- Path constants and repo discovery: `.trellis/scripts/common/paths.py`
- Session append/index update flow: `.trellis/scripts/add_session.py`
