# Notable — V1 Architecture Decisions

**Status:** Finalized for V1 implementation  
**Purpose:** Source of truth for OpenCode  
**Last updated:** 2026-10-04

## 1. Product Direction

A portfolio-quality, highly customizable digital notebook/workspace combining Notion-like flexibility, physical-notebook personality, and modern SaaS quality.

V1 includes:
- Note CRUD
- Markdown editing and preview
- Search, pinning, tags
- All/Pinned/Tag views
- First-run welcome notes
- System/Light/Dark color modes
- Default/Paper/Forest/Lavender visual presets
- Custom accent color with accessible derivation
- localStorage persistence
- Responsive desktop/tablet/mobile layouts
- Accessibility-first interaction

V1 excludes authentication, cloud sync, Supabase/Postgres, collaboration, AI, payments, file/image uploads, Markdown images, user-created theme definitions, custom fonts, density controls, page-background customization, syntax-highlighting systems, cross-tab theme synchronization, and theme animations/transitions. Monaco and CodeMirror are also excluded; the only rich text editor in V1 is TipTap.

## 2. Technology

- Next.js 16.3.8
- React 19.2.8
- TypeScript 5.9.3
- Tailwind CSS v4
- localStorage
- TipTap (ProseMirror) for rich text editing, with Markdown in and Markdown out
- Git/GitHub
- Vercel

Do not add dependencies without a concrete V1 need.

## 3. Architecture

UI → application/state → service → repository → persistence.

Only the repository/storage layer directly accesses browser storage.

## 4. Domain Model

The finalized Note model is:

    export interface Note {
      readonly id: string
      title: string
      content: string
      readonly createdAt: string
      updatedAt: string
      isPinned: boolean
      tags: string[]
    }

    export type NoteInput = Pick<Note, "title" | "content" | "tags">

    export type NoteUpdate = Partial<
      Pick<Note, "title" | "content" | "tags" | "isPinned">
    >

Rules:
- Repository owns IDs and timestamps.
- IDs use crypto.randomUUID().
- createdAt is immutable.
- timestamps are ISO 8601 UTC strings.
- updatedAt changes for title/content/tags, not pinning.
- Empty title is valid internally; UI displays "Untitled".
- Tags are normalized at the service boundary.
- Do not store derived excerpt, word count, or search text.

## 5. Repository

    interface NotesRepository {
      getAll(): Promise<Note[]>
      getById(id: string): Promise<Note | null>
      create(input: NoteInput): Promise<Note>
      update(id: string, input: NoteUpdate): Promise<Note>
      delete(id: string): Promise<void>
    }

V1 uses LocalStorageNotesRepository behind this abstraction.

Requirements:
- Promise-based interface
- repository-owned IDs/timestamps
- getById returns null when missing
- delete is idempotent
- repository errors propagate
- corrupted storage must not silently become []
- do not overwrite corrupt user data without recovery handling
- preserve contract for a future Supabase implementation
- application code must never directly call window.localStorage

## 6. Service Layer

Service owns get/create/update/delete/togglePin, validation, and tag normalization.

Pure selectors handle search/filter/sort/derived tags/display title.

Visible-note order:
1. pinned first
2. updatedAt descending within each group

Search is trimmed, case-insensitive substring matching across title/content/tags. Empty query disables search filtering.

Tag normalization trims, collapses whitespace, lowercases, removes leading #, removes/rejects commas according to validation, drops empty values, deduplicates, and applies Unicode NFC normalization.

Empty updates are no-ops returning the current note. Validation occurs after normalization. Use a typed ValidationError.

## 7. State Management

Use React built-ins only.

Notes:
- useReducer
- separate state/actions contexts
- state: loading/ready/error, notes, loadError, mutationError
- actions: create, update, delete, togglePin, retryLoad, clearMutationError

Workspace:
- active view: all/pinned/tag
- search query

Selected note:
- represented by /notes/[noteId], not duplicated in global state.

Editor:
- owns local title/content/tags drafts.

Theme:
- separate Context + simple state, not another reducer.

Theme state:

    {
      colorMode: "system" | "light" | "dark"
      preset: "default" | "paper" | "forest" | "lavender"
      accent: string | null
    }

## 8. App Providers and Hydration

AppProviders is the client composition root. It composes ThemeProvider, NotesProvider, Workspace provider, and shell context where required.

Root app/layout.tsx remains a Server Component.

Create/inject the concrete repository once at the composition root. Repository construction must be side-effect free.

Do not read localStorage during render or state initialization. Hydrate notes in an effect with cancellation protection. Initial server/client structure must match. Loading and storage-error states must be explicit.

## 9. Autosave and Mutation Queue

Editor drafts autosave with:
- about 800ms debounce
- about 5s maximum wait
- field-scoped patches
- unchanged fields omitted
- flush on unmount, blur, visibility hidden, pagehide, and Ctrl/Cmd+S

Save status communicates Saving, Saved, or Not saved.

All repository mutations use one serialized write queue. A failure rejects its caller but does not permanently break the queue. Do not use optimistic updates.

## 10. Routing and Shell

Routes:
- / redirects to /notes
- /notes
- /notes/[noteId]
- appropriate not-found and error boundaries

No /notes/new.

Create:
create → receive ID → navigate to /notes/[id] → focus title.

Delete:
confirm → delete → navigate to /notes → restore/focus list target.

Shell lives in app/notes/layout.tsx.

Desktop: sidebar + list + editor; no right context panel, resizable panes, collapsible desktop sidebar, or global top header.

Tablet: list + editor with drawer sidebar.

Mobile: list → editor screens, native dialog drawer, floating New Note action, no bottom tab bar.

Use CSS-driven responsive structure, not JS viewport detection. Approximate split breakpoint: 768px width and 500px height. Wide: 1280px width and 500px height. Test 430, 390, 375, and 320px plus tablet/desktop. Use 100dvh.

## 11. Editor and Markdown

V1:
- title
- tags
- rich text editing surface (TipTap)
- Edit/Preview toggle
- pin/delete controls
- save status

Markdown is the storage format and is never the thing on screen. A note opens by reading its Markdown into a document (`markdownToEditorHtml`), every edit is serialized back out of the document (`editorDocumentToMarkdown`), and autosave, exports and storage all see the same Markdown. Preview is that same document with editing switched off, not a second rendering, so the two cannot drift.

Note.content is unchanged, so existing notes, exports and the welcome notes keep working. The schema is written once in `lib/editor/extensions.ts` and read by both the parser and the serializer.

Do not use rehype-raw or dangerouslySetInnerHTML. Do not support Markdown images in V1. Draw every stored heading one level down: the note title is the page's only h1, so a stored `#` is drawn as an h2, `##` as an h3, and so on, while the stored level itself is untouched.

Revision: the Markdown textarea with a react-markdown preview was replaced by a rich text editor after the core editor proved stable. A toolbar is now part of the editor, with link entry as a small form rather than a bare button, because a link needs an address.

## 12. First-Run Notes

Seed a small set of useful welcome/example notes once. Store a separate seed flag. Deleting all notes must not cause reseeding.

## 13. Theme System

Theme state is:

    {
      colorMode: "system" | "light" | "dark"
      preset: "default" | "paper" | "forest" | "lavender"
      accent: string | null
    }

Persist appearance separately under `notes-app.theme`. Keep general settings under `notes-app.settings`.

System is the default color mode. Presets are separate from color mode and support light/dark variants.

Custom accent is stored as null or #RRGGBB. Null means preset default. The stored custom color is the user's seed; the effective accent may be lightness-adjusted for accessibility.

Do not introduce a runtime color library. Focus rings use a separate neutral high-contrast token.

## 14. Theme Tokens and Tailwind

Use a small semantic CSS-variable token system for:
- app/sidebar/list/page backgrounds
- primary/muted text
- border
- hover/selected
- accent/accent foreground
- focus ring
- success/warning/error
- code/blockquote/Markdown surfaces

Components consume semantic tokens rather than hardcoded hex colors.

Integrate these variables cleanly with Tailwind v4. Prefer root data attributes/classes for mode and preset. Avoid unnecessary plugins and excessive dark: variants.

## 15. No-Flash Theme Handling

Apply the initial theme before hydration using a small synchronous head script that safely reads and validates the persisted theme, determines mode/preset, and applies root attributes. It must fail safely to defaults.

Use suppressHydrationWarning where appropriate. Do not add global color transitions.

## 16. Appearance UI

Sidebar provides quick mode controls.

A compact native dialog provides:
- System/Light/Dark
- Default/Paper/Forest/Lavender
- preset-default/custom accent
- Reset
- Done

Changes apply live. No Apply/Cancel flow. Reset needs no confirmation.

On mobile the dialog may act as a bottom-sheet-style surface. Focus must be trapped/restored correctly.

## 17. Markdown Styling

Use hand-written scoped Markdown CSS with semantic theme tokens. No typography plugin solely for Markdown.

Style headings, paragraphs, links, lists/task lists, blockquotes, inline/code blocks, horizontal rules, and tables. No raw HTML and no Markdown images.

## 18. Accessibility and QA

Required:
- semantic HTML
- keyboard navigation
- visible focus
- landmarks and heading hierarchy
- skip link
- accessible dialogs/live regions
- 44px minimum touch targets
- 16px+ mobile form inputs
- no color-only communication
- reduced motion
- 320px reflow
- 200% zoom
- focus restoration
- accessible error states
- sufficient contrast

A contrast matrix is a V1 Must Have. Test every preset and light/dark combination plus extreme custom accents across text, muted text, accent text, focus ring, selected/hover, code, borders where relevant, and status colors. Include automated axe checks.

## 19. Testing

Test:
- domain/service rules and selectors
- repository contract and malformed storage
- reducer/provider transitions
- serialized queue
- autosave with fake timers
- core UI flows
- theme behavior
- accessibility
- responsive behavior
- contrast matrix
- production build

## 20. OpenCode Skills

Available:
- emil-design-eng: UI polish, component design, motion philosophy
- ui-ux-pro-max: visual/UI/UX, responsive design, typography, color systems

These are implementation aids only. They must not override this architecture or introduce unrelated features.

## 21. Implementation Discipline

OpenCode must read all project docs and inspect the repository before coding.

Implement in controlled phases and stop at phase boundaries. Report files changed, commands/tests run, failures, and concerns.

Never silently redesign finalized architecture. If a concrete conflict is found, stop, explain it, propose the smallest compatible change, and await approval if it materially affects architecture.

Do not add auth, cloud DB, Supabase, collaboration, AI, complex editors, raw HTML Markdown, Markdown images, theme registry, unnecessary state libraries, or unrelated product features.

## 22. Definition of V1 Complete

V1 is complete when core note management, Markdown, persistence, reliable autosave, first-run notes, theme modes/presets/custom accent, no-flash behavior, responsive layouts, keyboard/focus behavior, accessibility, contrast/axe checks, production build, and documentation all pass QA.

## 23. Implementation Order

1. Foundation
2. Domain + Repository
3. Service + State
4. Routing + App Shell
5. Notes List + Navigation
6. Editor
7. Theme System
8. Accessibility + Responsive Polish
9. Testing + QA
10. Portfolio Polish
11. GitHub
12. Vercel

Each phase is implemented and validated separately.
