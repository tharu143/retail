# ERP UI Redesign Notes

This branch applies a presentation-only redesign across the retail ERP UI.

## Scope

- Procurement, sales and returns, stock management, POS operations, reports, inventory logistics, and administration screens receive the shared ERP visual system.
- List, detail, create, edit, report, modal, table, filter, pagination, and form surfaces use the new spacing, typography, border, and responsive rules.
- `Home.jsx` keeps all three POS themes: `modern`, `modern_no_image`, and `legacy`.
- Existing Outfit font usage, green/teal brand direction, and blue sub-theme support are preserved.

## Safety Guard

The redesign is intentionally UI-only. Existing handlers, hooks, API calls, request payloads, calculations, validation, routing, and JSX conditions are preserved.

Run:

```bash
node scripts/check-ui-preservation.cjs
```

Expected result:

```text
PASS: 67 existing source files retain all non-presentation AST nodes (handlers, hooks, APIs, payloads, calculations, validation, routing and JSX conditions).
```

## Validation

Verified locally:

- `npm run build:ui`
- `node scripts/check-ui-preservation.cjs`
- `git diff --check`

Notes:

- Vite still reports the existing large chunk warning because the app bundle is already large.
- Live backend CRUD, role permission combinations, external device flows, and print hardware behavior still need final QA in the target deployment environment.
