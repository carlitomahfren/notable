# Notable — OpenCode Implementation Plan

**Status:** Ready for implementation  
**Source of truth:** `docs/architecture-decisions-v1.md`

## Before coding

OpenCode must:
1. Read `docs/project-specification-v1.md`.
2. Read `docs/technical-implementation-plan-v1.md`.
3. Read `docs/architecture-decisions-v1.md`.
4. Read `AGENTS.md` and referenced local Next.js docs.
5. Inspect the current repository, scripts, dependencies, and git status.
6. Avoid unrelated changes.

Use `emil-design-eng` and `ui-ux-pro-max` for execution quality only; they do not override the finalized architecture.

## Phase 1 — Foundation

Inspect and establish the minimum project foundation. Preserve the existing Turbopack root configuration. Establish required directories, foundational types/utilities, and conventions. Do not build the full UI.

Acceptance:
- build passes
- TypeScript passes
- no unrelated behavior breaks
- no unnecessary dependencies

## Phase 2 — Domain + Repository

Implement:
- Note / NoteInput / NoteUpdate
- validation and ValidationError
- tag normalization
- repository interface
- LocalStorageNotesRepository
- safe parsing/error handling
- timestamp and ID ownership
- repository tests

Acceptance:
- CRUD works
- corrupt storage is not silently converted to []
- delete is idempotent
- timestamp rules are correct
- application code does not directly access localStorage

## Phase 3 — Service + State

Implement:
- notes service
- selectors
- NotesProvider
- separate state/actions contexts
- Workspace provider
- serialized mutation queue
- hydration flow
- mutation errors

Acceptance:
- finalized state architecture is preserved
- selectors are pure
- mutations are serialized
- no optimistic updates
- storage errors surface correctly

## Phase 4 — Routing + Shell

Implement:
- root redirect
- notes routes
- notes layout
- AppProviders
- ShellContext where needed
- sidebar
- list/editor shell
- loading/error/not-found states
- responsive list/detail behavior

Acceptance:
- desktop: sidebar + list + editor
- tablet: list + editor + drawer sidebar
- mobile: list screen → editor screen
- no JS viewport detection for structural rendering

## Phase 5 — Notes List + Navigation

Implement:
- All/Pinned/Tag views
- search
- note list
- derived excerpts
- create/select/delete/pin
- empty/no-results states

Acceptance:
- pinned-first sorting
- title/content/tag search
- create navigates to generated ID
- delete returns to /notes
- no stale selection

## Phase 6 — Editor

Implement:
- title
- tags
- rich text writing surface
- Markdown in and Markdown out, with the document as the only on-screen form
- edit/preview over one document
- formatting toolbar and link form
- autosave
- save status
- pin/delete
- keyboard shortcuts
- welcome notes

Acceptance:
- debounce and max-wait work
- flush triggers work
- failed saves remain dirty
- raw HTML and Markdown images are unsupported
- heading hierarchy remains accessible: the title is the only h1, stored levels are drawn one down
- opening or previewing a note never marks it unsaved

Revision: shipped as a TipTap editor rather than a Markdown textarea with a react-markdown preview. The textarea was correct about storage and wrong about writing: it asked the reader to type asterisks and hash signs to get bold and a heading.

## Phase 7 — Theme System

Implement:
- ThemeProvider
- notes-app.theme persistence
- no-flash head logic
- semantic CSS variables
- four presets
- three color modes
- custom accent and accessible derivation
- Appearance dialog
- Markdown theme styling

Acceptance:
- System follows OS preference
- Light/Dark override System
- reload preserves appearance
- custom accent persists
- inaccessible accents are safely derived
- no obvious flash
- dialog is keyboard accessible
- reset works
- mobile appearance UI works

## Phase 8 — Accessibility + Responsive Polish

Audit:
- keyboard-only use
- focus visibility/restoration
- dialog semantics
- skip link
- live regions
- touch targets
- mobile form sizing
- 320px reflow
- 200% zoom
- reduced motion
- color-only communication

Use the available UI skills for restrained polish; do not add decorative features or scope.

## Phase 9 — Testing + QA

Required:
- service/domain tests
- repository contract tests
- reducer/state tests
- mutation queue tests
- autosave fake-timer tests
- core UI tests
- theme tests
- axe checks
- contrast matrix
- production build
- responsive browser testing

Contrast matrix must cover all four presets, light/dark, extreme custom accents, primary/muted/accent text, focus ring, selected/hover, code surfaces, and relevant status colors.

## Phase 10 — Portfolio Polish

Refine:
- hierarchy
- typography
- spacing
- empty/error/loading states
- interaction feedback
- responsive consistency
- restrained motion
- README/demo presentation

Do not introduce new product scope.

## Phase 11 — GitHub

Before pushing:
- build
- tests
- remove debug output
- verify README
- verify no secrets
- verify .gitignore
- inspect diff
- use focused commits

## Phase 12 — Vercel

After local QA and GitHub:
1. connect repository
2. verify build
3. deploy preview
4. test preview
5. deploy production
6. test production
7. verify localStorage behavior
8. document deployment

## Non-negotiable implementation rules

Never silently:
- replace the architecture
- add Redux/Zustand
- add auth
- add Supabase/cloud DB
- add collaboration
- add AI
- add complex editor libraries
- enable raw Markdown HTML
- add Markdown images
- create a theme registry
- introduce unnecessary dependencies
- rewrite unrelated docs

If a concrete architectural conflict appears, stop and report it before changing a finalized decision.
