# M2-04 Project Root Attribution

## Goal

Derive project-root identity from development activity signals and prioritize it over generic app/window labels.

## Attribution Rule

In desktop `window` capture mode:
1. Parse foreground window title.
2. Detect coding/editor context (for example VS Code, Cursor, JetBrains, Neovim).
3. Extract project candidate token from title segments.
4. Normalize to project key:
   - `resourceKind: 'project'`
   - `resourceKey: /workspace/<normalized-project>`
   - `resourceTitle: <project-name>`

If attribution fails, fallback remains:
- `resourceKind: 'app'`
- `resourceKey: window://...`
- `resourceTitle: window title`

## Compatibility

- Non-project activities are unchanged.
- Browser and mock providers are unaffected by this attribution path.
- Event contract remains `ActivityEvent` and is validated before append.

## Validation

`apps/desktop/test/capture-provider.test.ts` covers:
- editor title -> project root key extraction
- window provider project-priority capture
- non-project window capture fallback behavior
