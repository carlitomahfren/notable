# Notes App — Technical Implementation Plan v1

## Document Status

**Project:** Notes App  
**Phase:** Phase 2 — Technical Implementation Plan  
**Version:** 1.0  
**Status:** Ready for implementation  
**Source of Truth:** This document defines the technical approach for implementing V1 of the Notes App.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Technical Stack](#2-technical-stack)
3. [Application Architecture](#3-application-architecture)
4. [Target Project Structure](#4-target-project-structure)
5. [Note Data Model](#5-note-data-model)
6. [ID Generation](#6-id-generation)
7. [Persistence Architecture](#7-persistence-architecture)
8. [localStorage Strategy](#8-localstorage-strategy)
9. [State Management](#9-state-management)
10. [Application State](#10-application-state)
11. [Main Application Layout](#11-main-application-layout)
12. [Mobile Layout](#12-mobile-layout)
13. [Markdown Architecture](#13-markdown-architecture)
14. [Markdown Features](#14-markdown-features)
15. [Auto-Save](#15-auto-save)
16. [Search](#16-search)
17. [Filtering](#17-filtering)
18. [Sorting](#18-sorting)
19. [Theme Architecture](#19-theme-architecture)
20. [Initial Themes](#20-initial-themes)
21. [Custom Accent Colors](#21-custom-accent-colors)
22. [Accessibility Architecture](#22-accessibility-architecture)
23. [Responsive Architecture](#23-responsive-architecture)
24. [Component Strategy](#24-component-strategy)
25. [Error Handling](#25-error-handling)
26. [Empty States](#26-empty-states)
27. [Delete Behavior](#27-delete-behavior)
28. [Keyboard Shortcuts](#28-keyboard-shortcuts)
29. [Testing Strategy](#29-testing-strategy)
30. [Git Workflow](#30-git-workflow)
31. [Claude + OpenCode Workflow](#31-claude--opencode-workflow)
32. [Implementation Phases](#32-implementation-phases)
33. [V1 Definition of Done](#33-v1-definition-of-done)
34. [Out of Scope for V1](#34-out-of-scope-for-v1)
35. [Phase 2 Output](#35-phase-2-output)

---

# 1. Purpose

The purpose of this document is to translate the Notes App Project Specification v1 into a concrete technical implementation plan.

The Project Specification answers:

> **What are we building?**

This Technical Implementation Plan answers:

> **How are we building it?**

The implementation should prioritize:

- maintainability
- type safety
- responsive design
- accessibility
- clean architecture
- portfolio quality
- future extensibility
- controlled scope

The V1 application will use local browser persistence and will intentionally avoid authentication, cloud databases, collaboration, AI, and other advanced functionality until a later version.

---

# 2. Technical Stack

## Core

| Technology | Purpose |
|---|---|
| Next.js | Application framework |
| TypeScript | Type safety |
| React | UI/component system |
| Tailwind CSS | Styling and responsive design |
| localStorage | V1 persistence |
| Markdown | Note content format |
| Lucide React | Icons |
| Git + GitHub | Version control |
| Vercel | Deployment |

## Stack Principles

The stack should remain relatively lightweight.

Do not introduce libraries merely because they are popular. Every dependency should solve a real project requirement.

The application should remain easy to understand, maintain, deploy, and extend.

---

# 3. Application Architecture

The application should use a layered architecture.

```text
                    ┌─────────────────────┐
                    │      UI Layer       │
                    │ React Components    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Application Logic   │
                    │ hooks / operations  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Repository Layer  │
                    │   NotesRepository   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Persistence Layer   │
                    │    localStorage     │
                    └─────────────────────┘
```

The UI should not directly depend on localStorage.

This separation allows V1 to use localStorage while leaving room for a future database implementation.

Potential future architecture:

```text
NotesRepository
       │
       ├── LocalStorageNotesRepository
       │
       └── SupabaseNotesRepository
```

---

# 4. Target Project Structure

The intended structure is:

```text
Notes-App/
│
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── ...
│
├── components/
│   ├── notes/
│   │   ├── note-list.tsx
│   │   ├── note-card.tsx
│   │   ├── note-editor.tsx
│   │   ├── note-header.tsx
│   │   └── note-empty-state.tsx
│   │
│   ├── sidebar/
│   │   ├── sidebar.tsx
│   │   ├── sidebar-item.tsx
│   │   └── mobile-sidebar.tsx
│   │
│   ├── search/
│   │   └── search-bar.tsx
│   │
│   ├── themes/
│   │   ├── theme-provider.tsx
│   │   └── theme-selector.tsx
│   │
│   └── ui/
│       └── ...
│
├── lib/
│   ├── notes/
│   │   ├── notes-repository.ts
│   │   ├── notes-service.ts
│   │   └── note-utils.ts
│   │
│   ├── storage/
│   │   └── local-storage.ts
│   │
│   ├── themes/
│   │   ├── theme-config.ts
│   │   └── theme-utils.ts
│   │
│   └── utils/
│       └── ...
│
├── types/
│   ├── note.ts
│   ├── theme.ts
│   └── index.ts
│
├── public/
│
├── docs/
│   ├── project-specification-v1.md
│   └── technical-implementation-plan-v1.md
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── README.md
```

This is a target structure. Files should be created as implementation requires them rather than manually creating every file at once.

---

# 5. Note Data Model

The core entity is a `Note`.

Initial model:

```ts
export interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  tags: string[]
}
```

The initial model should remain intentionally simple.

Future versions may add properties such as:

```ts
export interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  tags: string[]

  // Future
  cover?: string
  icon?: string
  pageStyle?: string
  fontStyle?: string
  backgroundStyle?: string
}
```

Future properties should not be implemented in V1 unless they become necessary.

---

# 6. ID Generation

Every note needs a unique identifier.

Use:

```ts
crypto.randomUUID()
```

rather than manually incrementing IDs.

UUID-based identifiers are better suited to eventual database synchronization and avoid collisions.

---

# 7. Persistence Architecture

The application should use a repository abstraction.

Conceptually:

```ts
interface NotesRepository {
  getAll(): Note[]
  getById(id: string): Note | null
  create(note: Note): void
  update(id: string, note: Partial<Note>): void
  delete(id: string): void
}
```

V1 implementation:

```text
NotesRepository
       │
       ▼
LocalStorageNotesRepository
```

Future implementation:

```text
NotesRepository
       │
       ├── LocalStorageNotesRepository
       │
       └── SupabaseNotesRepository
```

This allows the UI and application logic to remain independent of the persistence technology.

---

# 8. localStorage Strategy

Use a dedicated application namespace for stored data.

Example key categories:

```text
notes-app.notes
notes-app.theme
notes-app.settings
```

Notes will be serialized as JSON:

```text
Note[]
   ↓
JSON.stringify()
   ↓
localStorage
```

and loaded with:

```text
localStorage
   ↓
JSON.parse()
   ↓
Note[]
```

## Important Next.js Constraint

Next.js can render components on the server.

Therefore, browser-only APIs such as `localStorage` must not be accessed during server rendering.

Storage access should occur in client-side code.

---

# 9. State Management

V1 should not immediately introduce Redux, Zustand, or another large state-management library.

The application is small enough to use:

- React state
- custom hooks
- Context where appropriate
- repository/service functions

A possible central notes provider:

```text
NotesProvider
      │
      ├── notes
      ├── selectedNote
      ├── searchQuery
      ├── selectedTag
      └── actions
```

A potential custom hook:

```ts
useNotes()
```

could expose:

```text
notes
createNote()
updateNote()
deleteNote()
togglePin()
searchNotes()
```

The exact implementation should be determined during development.

---

# 10. Application State

Primary state categories:

## Notes

```text
notes
selectedNoteId
```

## Search

```text
searchQuery
```

## Filtering

```text
activeFilter
selectedTag
```

## UI

```text
sidebarOpen
searchOpen
deleteDialogOpen
```

## Theme

```text
theme
accentColor
```

Avoid placing unrelated application state into one giant state object.

---

# 11. Main Application Layout

The desktop interface should conceptually provide:

```text
┌─────────────────────────────────────────────────────────────┐
│ Logo        Search                     Theme   New Note     │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│ All Notes    │                              │               │
│ Pinned       │        Notes / Editor        │   Context     │
│ Tags         │                              │   / Preview   │
│              │                              │               │
│              │                              │               │
└──────────────┴──────────────────────────────┴───────────────┘
```

This is a conceptual layout, not a strict requirement for three columns.

The final UI should prioritize:

1. note navigation
2. editing
3. readability
4. responsive behavior
5. visual clarity

---

# 12. Mobile Layout

Mobile should be designed as its own responsive experience rather than simply shrinking the desktop layout.

Conceptual structure:

```text
┌──────────────────────────────┐
│ ☰     Notes          +      │
├──────────────────────────────┤
│ Search                       │
├──────────────────────────────┤
│                              │
│ Note list / editor           │
│                              │
│                              │
├──────────────────────────────┤
│ All    Pinned    Tags        │
└──────────────────────────────┘
```

The desktop sidebar may become:

- a drawer
- a sheet
- bottom navigation
- contextual navigation

The final choice should be based on usability testing.

---

# 13. Markdown Architecture

Note content will be stored as Markdown.

Example:

```md
# My Note

This is **important**.

- Item one
- Item two

> This is a quote.
```

There are two conceptual modes:

## Editing

```text
Markdown text
      ↓
Markdown editor
```

## Viewing

```text
Markdown
      ↓
Markdown parser
      ↓
Rendered React/HTML
```

V1 should use a reliable Markdown library rather than implementing a custom Markdown parser.

---

# 14. Markdown Features

V1 should support:

- headings
- paragraphs
- bold
- italic
- strikethrough if practical
- ordered lists
- unordered lists
- checklists
- links
- blockquotes
- code blocks
- inline code
- horizontal rules

Potential future features:

- tables
- images
- embeds
- syntax highlighting
- footnotes
- mathematical notation

Future Markdown features remain outside the initial V1 scope.

---

# 15. Auto-Save

Users should not have to manually save every edit.

Intended flow:

```text
User edits
    ↓
State changes
    ↓
Debounced save
    ↓
Repository
    ↓
localStorage
```

Saving should be debounced instead of writing to localStorage on every keystroke.

A starting point can be approximately 300–500 ms after the user stops typing, subject to testing.

---

# 16. Search

V1 search should search:

```text
title
content
tags
```

Example:

```text
Search: "react"
```

can match:

```text
Title: React Study Notes
```

or:

```text
Content: React Server Components...
```

or:

```text
Tags: #react
```

Search should update quickly as the user types.

For V1, client-side search is sufficient.

Future possibilities:

- fuzzy search
- search operators
- advanced filtering
- semantic search
- AI-powered search

---

# 17. Filtering

The application should support:

```text
All Notes
Pinned
Tags
```

Example tag navigation:

```text
Tags

#School
#Work
#Ideas
#Personal
#Projects
```

Selecting a tag should filter the note list.

---

# 18. Sorting

Default sorting should prioritize recently updated notes.

A possible presentation:

```text
Pinned
──────
Important Project
Thesis Notes

Recent
──────
React Study
Random Idea
Shopping List
```

The exact sorting rules should be finalized during implementation and UX testing.

---

# 19. Theme Architecture

Customization is one of the major differentiators of the application.

Colors should not be hard-coded throughout individual components.

Instead:

```text
Theme
  ↓
CSS Variables
  ↓
Components
```

Example semantic design tokens:

```css
--background
--foreground
--surface
--surface-secondary
--border
--accent
--accent-foreground
--muted
--muted-foreground
```

Components should consume semantic tokens rather than hard-coded colors.

This will make future customization significantly easier.

---

# 20. Initial Themes

Possible initial theme presets:

```text
Light
Dark
Sepia
Paper
Forest
Ocean
Lavender
```

These are starting presets, not a final list.

The long-term goal is for the user to feel like they are customizing their own notebook.

---

# 21. Custom Accent Colors

V1 should support choosing an accent color.

Example:

```text
Accent
────────────────
Blue
Purple
Green
Orange
Pink
Red
Custom
```

The selected accent should be represented through a CSS variable.

Example:

```css
--accent: ...
```

Contrast should be checked so that the chosen accent does not make interactive elements inaccessible.

---

# 22. Accessibility Architecture

Accessibility should be considered during implementation rather than treated as a final cleanup step.

## Keyboard Navigation

Core workflows should be usable without a mouse.

## Focus

Interactive elements need visible focus indicators.

## Buttons

Icon-only buttons need accessible names.

Example:

```html
<button aria-label="Create new note">
```

## Forms

Inputs should have labels or appropriate accessible names.

## Dialogs

Dialogs should correctly handle:

- focus management
- Escape
- keyboard navigation
- screen-reader semantics

## Color

Information should not be communicated exclusively through color.

## Motion

Animations should respect:

```text
prefers-reduced-motion
```

---

# 23. Responsive Architecture

The application should be tested at the following target sizes.

## Desktop

```text
1920 × 1080
1440 × 900
1366 × 768
```

## Tablet

```text
1024 × 768
768 × 1024
```

## Mobile

```text
430 × 932
390 × 844
375 × 667
```

The actual requirement is broader than these specific sizes:

> No major layout should break at intermediate viewport widths.

---

# 24. Component Strategy

Components should be organized by responsibility.

For example, `NoteCard` should primarily display a note.

It should not contain:

- localStorage logic
- theme persistence
- search algorithms
- database access

Instead:

```text
UI
 ↓
hooks / services
 ↓
repository
```

This keeps the application maintainable and easier to test.

---

# 25. Error Handling

The application should account for:

- corrupted localStorage
- missing notes
- invalid note data
- failed saves
- empty titles
- empty notes
- deleting the selected note
- malformed Markdown
- unavailable browser storage

Example:

```text
localStorage contains invalid JSON
        ↓
application detects error
        ↓
recover gracefully
        ↓
application does not crash
```

Error handling should favor graceful recovery and clear user feedback.

---

# 26. Empty States

Intentional empty states are required.

## No Notes

```text
No notes yet.

Create your first note and start building
your personal workspace.

[ Create Note ]
```

## Search With No Results

```text
No notes found.

Try another search term.
```

## No Pinned Notes

```text
Nothing pinned yet.

Pin important notes to keep them here.
```

These states should feel designed rather than like missing content.

---

# 27. Delete Behavior

Deleting a note should require confirmation.

Example:

```text
Delete note?

"React Study Notes" will be permanently
removed from this device.

[Cancel] [Delete]
```

Because V1 uses localStorage, deletion is local and permanent unless the user has another copy.

---

# 28. Keyboard Shortcuts

Initial candidates:

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + N` | New note |
| `Ctrl/Cmd + K` | Search |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + Shift + P` | Pin/unpin |
| `Esc` | Close dialog/panel |

Shortcuts should be implemented only where they do not conflict with expected browser or editor behavior.

---

# 29. Testing Strategy

Testing should happen continuously rather than only at the end.

## Development Cycle

```text
Implement
↓
Run
↓
Test
↓
Fix
↓
Commit
```

## Functional Testing

Verify:

- create
- edit
- delete
- pin
- search
- tags
- Markdown
- persistence
- themes

## Responsive Testing

Test desktop, tablet, mobile, and intermediate widths.

## Accessibility Testing

Check:

- keyboard navigation
- focus visibility
- contrast
- labels
- dialogs
- semantic HTML
- reduced motion

## Persistence Testing

Critical scenario:

```text
Create note
↓
Refresh page
↓
Note still exists
```

Also:

```text
Create note
↓
Close browser
↓
Reopen
↓
Note still exists
```

---

# 30. Git Workflow

The project should use small, meaningful commits instead of one large final commit.

Example commit sequence:

```text
chore: initialize next.js project

feat: create notes application shell

feat: implement note data model

feat: add local notes repository

feat: implement note creation

feat: implement note editing

feat: implement note deletion

feat: add markdown editor

feat: add note search

feat: add note tagging

feat: add theme system

feat: add custom accent colors

feat: improve mobile navigation

feat: improve accessibility

test: verify note persistence

docs: add technical implementation plan
```

Commit messages should describe the actual change being made.

---

# 31. Claude + OpenCode Workflow

The project will intentionally use multiple AI tools with distinct responsibilities.

## ChatGPT

Role:

```text
Project Coordinator
Technical Architect
Reviewer
Debugger
Prompt Engineer
Scope Controller
```

Responsibilities include:

- maintaining project direction
- breaking work into tasks
- creating prompts
- reviewing implementation decisions
- debugging
- protecting project scope
- reviewing AI-generated work
- coordinating Claude and OpenCode

## Claude

Best suited for:

```text
Architecture reasoning
UI/UX decisions
Complex implementation
Code review
Refactoring
Edge cases
Accessibility review
```

## OpenCode

Best suited for:

```text
Repository operations
Creating/editing files
Running commands
Installing dependencies
Running tests
Applying implementation changes
```

## Workflow

```text
                 ┌──────────────┐
                 │   ChatGPT    │
                 │ Plan / Review│
                 └──────┬───────┘
                        │
               ┌────────┴────────┐
               ▼                 ▼
          ┌─────────┐       ┌─────────┐
          │ Claude  │       │ OpenCode│
          │ Reason  │       │ Build   │
          └────┬────┘       └────┬────┘
               │                 │
               └────────┬────────┘
                        ▼
                  ┌───────────┐
                  │    Git    │
                  │   Commit  │
                  └───────────┘
```

AI output should be reviewed rather than blindly accepted.

---

# 32. Implementation Phases

## Phase 2A — Project Initialization

- initialize Next.js
- configure TypeScript
- configure Tailwind
- install required dependencies
- initialize Git
- establish project structure
- verify development environment

## Phase 2B — Application Shell

- global layout
- sidebar
- header
- responsive navigation
- basic empty states

## Phase 2C — Notes Core

- Note type
- repository
- localStorage
- create
- read
- update
- delete

## Phase 2D — Editor

- Markdown editor
- Markdown rendering
- toolbar
- autosave
- timestamps

## Phase 2E — Organization

- search
- tags
- pinning
- sorting
- filters

## Phase 2F — Customization

- light/dark themes
- theme presets
- accent colors
- notebook styling groundwork

## Phase 2G — Responsive + Accessibility

- mobile UI
- tablet UI
- keyboard navigation
- focus management
- ARIA
- reduced motion
- contrast

## Phase 2H — QA

- functional testing
- responsive testing
- persistence testing
- edge cases
- performance review

## Phase 2I — Portfolio Polish

- animations
- micro-interactions
- visual refinement
- README
- screenshots
- project documentation

## Phase 2J — Deployment

```text
GitHub
  ↓
Vercel
  ↓
Production
  ↓
Portfolio
```

Vercel deployment will be handled step-by-step when the application is ready.

---

# 33. V1 Definition of Done

## Functionality

- [ ] Create notes
- [ ] Edit notes
- [ ] Delete notes
- [ ] Pin notes
- [ ] Search notes
- [ ] Tags
- [ ] Markdown
- [ ] Autosave
- [ ] localStorage persistence
- [ ] Themes
- [ ] Accent customization

## UX

- [ ] Clear navigation
- [ ] Empty states
- [ ] Delete confirmation
- [ ] Responsive editor
- [ ] Responsive navigation
- [ ] Clear feedback
- [ ] No major UX dead ends

## Accessibility

- [ ] Keyboard navigation
- [ ] Visible focus
- [ ] Accessible labels
- [ ] Good contrast
- [ ] Semantic HTML
- [ ] Accessible dialogs
- [ ] Reduced motion

## Engineering

- [ ] TypeScript
- [ ] Repository abstraction
- [ ] Clean component boundaries
- [ ] No unnecessary dependencies
- [ ] No obvious console errors
- [ ] Organized Git history

## Deployment

- [ ] GitHub repository
- [ ] Production build succeeds
- [ ] Vercel deployment succeeds
- [ ] Production URL works
- [ ] Mobile production site tested

---

# 34. Out of Scope for V1

The following should not be implemented during the initial V1 build:

```text
Authentication
Supabase
PostgreSQL
Real-time collaboration
AI
File uploads
Cloud synchronization
Sharing
Team workspaces
Payments
Native mobile application
```

These can be evaluated for future versions.

The purpose of V1 is to establish a polished, usable, technically sound notes application before introducing additional complexity.

---

# 35. Phase 2 Output

The official project documentation should now be organized as:

```text
Notes-App/
└── docs/
    ├── project-specification-v1.md
    └── technical-implementation-plan-v1.md
```

The overall development progression is:

```text
Phase 1
Project Specification
        ↓
"What are we building?"

Phase 2
Technical Implementation Plan
        ↓
"How are we building it?"

Phase 3
Implementation
        ↓
"Build it."

Phase 4
Testing / QA
        ↓
"Does it actually work?"

Phase 5
Deployment
        ↓
"Put it online."

Phase 6
Portfolio Presentation
        ↓
"Show recruiters why it matters."
```

---

## Document Control

**Project:** Notes App  
**Document:** Technical Implementation Plan  
**Version:** 1.0  
**Phase:** 2  
**Status:** Ready for implementation  

This document should be updated if major architectural decisions change during development. Minor implementation details do not require rewriting the plan unless they materially affect the architecture or V1 scope.
