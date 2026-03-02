# Rules (Moescape Concept)

Use this file as the default instruction entrypoint for agents working on this prototype.

## Project scope

Work only in:

- `/Users/andrewbostan/Documents/RisuAII/prototypes/structure-lab/moescape-concept`

## Required docs (read first)

Canonical copies live in `docs/` at repo root. Prototype copies here are kept in sync and used by `pnpm run check:prototype`.

- [Repository Conventions](/Users/andrewbostan/Documents/RisuAII/CONVENTIONS.md)
- [Design Rules](/Users/andrewbostan/Documents/RisuAII/docs/DESIGN_RULES.md)
- [Testing Rules](/Users/andrewbostan/Documents/RisuAII/docs/TESTING_RULES.md)
- [UI Change Checklist](/Users/andrewbostan/Documents/RisuAII/docs/UI_CHANGE_CHECKLIST.md)
- [Concept Completion Checklist](/Users/andrewbostan/Documents/RisuAII/docs/CONCEPT_COMPLETION_CHECKLIST.md)
- [Migration Map](/Users/andrewbostan/Documents/RisuAII/docs/MIGRATION_MAP.md)
- [Migration Plan](/Users/andrewbostan/Documents/RisuAII/docs/MIGRATION_PLAN.md)

## Mandatory execution contract

1. Implement change.
2. Run:
   - `pnpm run check:prototype`
3. Perform manual UI smoke pass if UI changed.
4. Update all impacted docs if the change is significant.

## Documentation update rule (required)

After any significant change, update docs in the same change set.

Significant change includes:

- navigation/layout/routing changes
- state model changes
- rendering contract or primitive changes
- testing contract changes

At minimum, review and update as needed (update **both** the `docs/` canonical copy and the prototype copy here):

- [Design Rules](/Users/andrewbostan/Documents/RisuAII/docs/DESIGN_RULES.md)
- [UI Change Checklist](/Users/andrewbostan/Documents/RisuAII/docs/UI_CHANGE_CHECKLIST.md)
- [Concept Completion Checklist](/Users/andrewbostan/Documents/RisuAII/docs/CONCEPT_COMPLETION_CHECKLIST.md)
- [Migration Map](/Users/andrewbostan/Documents/RisuAII/docs/MIGRATION_MAP.md)
- [Migration Plan](/Users/andrewbostan/Documents/RisuAII/docs/MIGRATION_PLAN.md)

## What agents must not do

- Do not use `innerHTML` outside the documented `htmlToFragment()` -> `replaceMarkup()` exception path.
- Do not add inline `style="...display:..."` or JS `style.display = ...` for view/shell visibility control.
- Do not toggle top-level views (`homeView`, `chatView`, `libraryView`, `playgroundView`, `settingsView`) outside `enterXView()` functions.
- Do not route global drawer navigation by text labels, DOM order, or position; use `data-workspace-view` + `dataset`.
- Do not bypass `openDrawer()` / `closeDrawer()` with direct drawer `classList` open/close mutations.
