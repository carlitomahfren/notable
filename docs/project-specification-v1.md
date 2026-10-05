# Notable — Project Specification v1

> **Portfolio Side Project #1**  
> **Status:** Specification v1 — Ready for Implementation Planning  
> **Repository / Local Directory:** `Portfolio Projects/Notes-App`  
> **Deployment Target:** Vercel  
> **Primary Development Assistants:** Claude + OpenCode

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [Product Principles](#4-product-principles)
5. [V1 Scope](#5-v1-scope)
6. [V1 Non-Goals](#6-v1-non-goals)
7. [Application Structure](#7-application-structure)
8. [Responsive Design](#8-responsive-design)
9. [Note Data Model](#9-note-data-model)
10. [Persistence Strategy](#10-persistence-strategy)
11. [Theme and Customization System](#11-theme-and-customization-system)
12. [Notebook and Journal Personality](#12-notebook-and-journal-personality)
13. [Search](#13-search)
14. [Tags and Organization](#14-tags-and-organization)
15. [UI and UX States](#15-ui-and-ux-states)
16. [UX Requirements](#16-ux-requirements)
17. [Keyboard Shortcuts](#17-keyboard-shortcuts)
18. [Responsive Requirements](#18-responsive-requirements)
19. [Accessibility Requirements](#19-accessibility-requirements)
20. [Technology Stack](#20-technology-stack)
21. [Architecture Philosophy](#21-architecture-philosophy)
22. [Proposed Project Structure](#22-proposed-project-structure)
23. [Claude + OpenCode Workflow](#23-claude--opencode-workflow)
24. [Git Strategy](#24-git-strategy)
25. [Deployment Strategy](#25-deployment-strategy)
26. [V1 Success Criteria](#26-v1-success-criteria)
27. [Future Roadmap](#27-future-roadmap)
28. [Scope Management Rule](#28-scope-management-rule)
29. [Final Product Direction](#29-final-product-direction)
30. [Current Status and Next Step](#30-current-status-and-next-step)

---

# 1. Project Overview

The **Notable** app is the first side project in the portfolio project roadmap.

The initial application will be a responsive, highly customizable digital notes and personal workspace application. It will be inspired by the flexibility of products such as Notion while deliberately emphasizing the feeling and freedom of a physical notebook, journal, or personal workspace.

The application will initially be built as a portfolio-focused V1 without authentication, a cloud database, or collaborative functionality.

The architecture should nevertheless be designed so that these capabilities can be introduced in later versions without requiring a complete rewrite.

### Current local directory

```text
Desktop/
└── Portfolio Projects/
    └── Notes-App/
```

---

# 2. Product Vision

## 2.1 Core Concept

Build a **free, highly customizable digital notebook and personal workspace** that combines:

- The organizational flexibility of modern productivity applications
- The simplicity of a notes application
- The personality and freedom of a physical notebook or journal
- The polish expected from a modern SaaS product

The application's central philosophy is:

> **"Your notes should feel like your notebook."**

Users should eventually be able to customize their workspace instead of being restricted to a single visual style.

Customization should eventually cover areas such as:

- Colors
- Themes
- Typography
- Page appearance
- Layouts
- Note organization
- Backgrounds
- Icons
- Notebook styles

Despite offering significant customization, the application must remain approachable and easy to use.

## 2.2 Product Positioning

The goal is **not** to simply build a "free version of Notion."

The goal is to build an independent product inspired by the strengths of modern workspace applications while differentiating it through:

- Personalization
- Notebook/journal aesthetics
- Freedom of visual customization
- A focused personal workspace experience

---

# 3. Target Users

The initial target user is someone who wants a flexible personal workspace for:

- Personal notes
- School notes
- Work notes
- Journaling
- Ideas
- Project planning
- To-do lists
- Study material
- Personal documentation
- Brain dumps
- Daily planning

The application should be useful without requiring users to understand complicated productivity systems.

---

# 4. Product Principles

These principles should guide product and engineering decisions throughout development.

## 4.1 Customization

Users should eventually have meaningful control over how their workspace looks and feels.

## 4.2 Simplicity

Customization should not make the application confusing or overwhelming.

## 4.3 Personalization

The application should feel like the user's own notebook rather than a generic SaaS dashboard.

## 4.4 Responsive by Default

Desktop must not be treated as the primary platform with mobile support added later.

The application should be designed for:

- Desktop
- Laptop
- Tablet
- Mobile
- Small mobile screens
- Portrait and landscape orientations

## 4.5 Accessibility

The application should be usable through:

- Keyboard navigation
- Screen readers where applicable
- Appropriate color contrast
- Visible focus indicators
- Semantic HTML
- Accessible form controls
- Appropriate ARIA attributes where necessary

## 4.6 Portfolio Quality

The application should demonstrate real software engineering practices rather than simply being a tutorial-style CRUD application.

---

# 5. V1 Scope

V1 focuses on establishing the **core notebook experience**.

We should not attempt to recreate every feature of Notion during the first iteration.

## 5.1 Notes

V1 must support:

- Create notes
- Read/view notes
- Edit notes
- Delete notes
- Search notes
- Pin/unpin notes
- Tags
- Note titles
- Note content
- Creation timestamps
- Updated timestamps

## 5.2 Editor

The editor must support Markdown.

Initial formatting should include:

- Headings
- Paragraphs
- Bold
- Italic
- Lists
- Checklists
- Links
- Code blocks
- Quotes

The exact editor implementation can be finalized during the technical implementation phase.

## 5.3 Organization

The initial application should provide:

- All Notes
- Pinned Notes
- Tags
- Search

## 5.4 Customization

V1 should support:

- Light mode
- Dark mode
- Custom accent color
- Multiple predefined themes

## 5.5 Persistence

Notes must remain available after refreshing the browser.

V1 will use browser-local persistence rather than a cloud database.

## 5.6 Responsive Interface

The complete application must be usable on:

- Desktop
- Tablet
- Mobile

---

# 6. V1 Non-Goals

The following capabilities are explicitly outside the V1 scope unless a later decision changes this specification.

## 6.1 Authentication

V1 will not include:

- Login
- Registration
- Passwords
- OAuth
- User accounts

## 6.2 Cloud Database

V1 will not require:

- Supabase
- PostgreSQL
- Firebase
- Other hosted databases

## 6.3 Collaboration

V1 will not include:

- Real-time collaborative editing
- Shared notes
- Comments
- Team workspaces

## 6.4 Artificial Intelligence

No AI features are required for V1.

## 6.5 Payments

No subscriptions or payment systems will be implemented.

## 6.6 Cloud Synchronization

V1 will not synchronize notes across devices.

## 6.7 Cloud File Storage

V1 will not require cloud-based file uploads or storage.

These capabilities are reserved for future versions.

---

# 7. Application Structure

The desktop interface is expected to follow a workspace-oriented structure.

A possible initial layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Header / Search / Actions                                  │
├──────────────┬───────────────────────────┬──────────────────┤
│              │                           │                  │
│   Sidebar    │       Notes / Editor      │   Optional       │
│              │                           │   Context Panel  │
│   All Notes  │                           │                  │
│   Pinned     │                           │                  │
│   Tags       │                           │                  │
│              │                           │                  │
│   Themes     │                           │                  │
│              │                           │                  │
└──────────────┴───────────────────────────┴──────────────────┘
```

This is a conceptual layout rather than a strict implementation requirement.

The final UI should be determined during the UI/UX design phase.

---

# 8. Responsive Design

The mobile interface should not simply be a compressed version of the desktop interface.

The information architecture should adapt to the available space.

## 8.1 Potential Mobile Structure

```text
┌──────────────────────────┐
│ Menu   Notes      Search │
├──────────────────────────┤
│                          │
│       Notes / Editor     │
│                          │
│                          │
│                          │
├──────────────────────────┤
│ Home  Search  +  Tags ⚙ │
└──────────────────────────┘
```

Depending on the final UX, the desktop sidebar may become:

- A drawer
- A sheet
- A modal
- Bottom navigation
- Another mobile-specific navigation pattern

The final solution should prioritize usability rather than preserving the desktop layout at all costs.

---

# 9. Note Data Model

A V1 note can conceptually contain:

```text
Note
├── id
├── title
├── content
├── createdAt
├── updatedAt
├── isPinned
├── tags[]
└── theme/customization metadata (if applicable)
```

The final TypeScript interface will be defined during implementation planning.

The data model should remain flexible enough to support a future migration to PostgreSQL/Supabase.

---

# 10. Persistence Strategy

## 10.1 V1

V1 will use browser-local persistence, most likely through:

**localStorage**

However, UI components should not be tightly coupled directly to localStorage.

The preferred conceptual architecture is:

```text
UI
 │
 ↓
Notes Application Logic
 │
 ↓
Notes Repository
 │
 ↓
Local Storage
```

## 10.2 Future

A future version can replace the persistence layer:

```text
UI
 │
 ↓
Notes Application Logic
 │
 ↓
Notes Repository
 │
 ↓
Supabase
 │
 ↓
PostgreSQL
```

This separation is intentional.

It allows the application to move from local-only storage to cloud persistence without requiring the entire frontend to be rewritten.

---

# 11. Theme and Customization System

Customization is one of the defining characteristics of the project.

## 11.1 Basic Theme Modes

V1 should include:

- Light
- Dark

## 11.2 Additional Themes

V1 should also support several predefined themes.

Possible examples:

- Sepia
- Paper
- Forest
- Ocean
- Lavender

These names are examples and can be changed during design.

## 11.3 Custom Accent Color

Users should be able to choose an accent color.

The theme system should conceptually define tokens such as:

```text
Background
Foreground
Surface
Secondary Surface
Border
Accent
Accent Foreground
Muted
```

## 11.4 Implementation Approach

Themes should be implemented through CSS variables/design tokens instead of hardcoding colors throughout individual components.

Example:

```css
--background
--foreground
--surface
--surface-secondary
--border
--accent
--accent-foreground
```

This architecture makes future customization easier.

---

# 12. Notebook and Journal Personality

The application should eventually feel more personal than a conventional SaaS notes dashboard.

Although not all of these features belong in V1, the architecture should not prevent them.

## 12.1 Page Backgrounds

Potential future options:

- Plain
- Lined
- Grid
- Dotted
- Paper

## 12.2 Typography

Potential future options:

- Sans-serif
- Serif
- Handwritten-style
- Monospace

## 12.3 Page Styles

Potential future options:

- Minimal
- Journal
- Notebook
- Scrapbook

## 12.4 Visual Elements

Potential future options:

- Stickers
- Icons
- Covers
- Decorative elements

These features are future enhancements and should not delay V1.

---

# 13. Search

V1 search should support searching by:

- Note title
- Note content
- Tags

## 13.1 Search Interface

The search experience should provide:

- Search input
- Instant filtering
- Empty search state
- No-results state

## 13.2 Future Search Capabilities

Potential future improvements include:

- Advanced search
- Search operators
- Fuzzy search
- Semantic search
- AI-powered search

---

# 14. Tags and Organization

Users should be able to assign multiple tags to a note.

Example tags:

```text
#School
#Work
#Ideas
#Personal
#Projects
```

The sidebar may eventually show counts:

```text
Tags

#School       12
#Work          8
#Ideas        15
#Personal      6
```

Selecting a tag should filter the visible notes.

---

# 15. UI and UX States

The application should explicitly handle the following states.

## 15.1 Normal State

Notes exist and can be viewed or edited.

## 15.2 Empty State

No notes have been created.

The UI should explain what the user can do next.

## 15.3 Search State

The user is actively searching.

## 15.4 Search No-Results State

The search query returns no matching notes.

## 15.5 Loading State

A loading state should exist for operations that may become asynchronous in future versions.

## 15.6 Error State

The user should receive understandable feedback when something fails.

## 15.7 Delete Confirmation

Destructive actions should include appropriate safeguards.

---

# 16. UX Requirements

The application should feel fast, intuitive, and predictable.

Important UX considerations include:

- Clear hover states
- Clear active states
- Visible keyboard focus
- Smooth but restrained transitions
- Confirmation for destructive actions
- Autosave where appropriate
- Clear feedback after actions
- Undo where practical
- Minimal unnecessary modal usage
- Clear navigation hierarchy

Animations should enhance the experience without becoming distracting.

---

# 17. Keyboard Shortcuts

Potential V1 shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Search |
| `Ctrl/Cmd + N` | New note |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + Shift + P` | Pin note |
| `Esc` | Close modal/panel |

These shortcuts are subject to change during implementation and should not conflict with browser or operating-system behavior.

---

# 18. Responsive Requirements

The application should be tested against representative viewport sizes.

## Desktop

- 1920×1080
- 1440×900
- 1366×768

## Tablet

- 1024×768
- 768×1024

## Mobile

- 430×932
- 390×844
- 375×667
- Small-width devices

These are testing targets and must not be treated as hardcoded supported resolutions.

The application should use responsive layout techniques rather than device-specific hacks.

---

# 19. Accessibility Requirements

The project should follow WCAG-oriented development practices.

Minimum requirements:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- Sufficient color contrast
- Accessible buttons
- Accessible form labels
- Meaningful alternative text where images exist
- No important information conveyed only through color
- Appropriate ARIA attributes where necessary
- Reduced-motion consideration
- Logical heading hierarchy
- Clear error messages

Accessibility should be considered during implementation rather than treated as a final checklist.

---

# 20. Technology Stack

## Framework

**Next.js**

## Language

**TypeScript**

## Styling

**Tailwind CSS**

## Persistence

**localStorage for V1**

## Markdown

A suitable Markdown parsing/rendering library.

The exact library will be selected during technical planning.

## Icons

A lightweight icon library such as **Lucide** may be used.

## Version Control

**Git + GitHub**

## Development Assistance

- Claude
- OpenCode

## Deployment

**Vercel**

---

# 21. Architecture Philosophy

The project should avoid unnecessarily coupling UI components, application logic, and persistence.

The preferred conceptual architecture is:

```text
UI
 │
 ↓
Application Logic
 │
 ↓
Repository / Data Access
 │
 ↓
Persistence
```

For V1:

```text
Persistence
└── localStorage
```

For a future cloud version:

```text
Persistence
└── Supabase / PostgreSQL
```

This separation should make the project easier to test, maintain, and extend.

---

# 22. Proposed Project Structure

The following structure is a starting point and should be finalized after the Next.js project is initialized:

```text
Notes-App/
│
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── ...
│
├── components/
│   ├── notes/
│   ├── editor/
│   ├── sidebar/
│   ├── search/
│   ├── themes/
│   └── ui/
│
├── lib/
│   ├── notes/
│   ├── storage/
│   ├── themes/
│   └── utils/
│
├── types/
│
├── public/
│
├── docs/
│
├── package.json
├── tsconfig.json
└── README.md
```

This is not a strict requirement. The final structure should reflect the actual application architecture.

---

# 23. Claude + OpenCode Workflow

The project will intentionally use both Claude and OpenCode.

## 23.1 Claude

Claude should be used primarily for:

- Architecture discussion
- Planning
- Code review
- Complex reasoning
- UI/UX ideas
- Debugging
- Refactoring suggestions
- Reviewing implementation decisions
- Identifying potential edge cases

## 23.2 OpenCode

OpenCode should be used primarily for:

- Working directly within the repository
- Implementing defined tasks
- Editing files
- Running development commands
- Running tests
- Iterative implementation
- Inspecting the existing codebase

## 23.3 ChatGPT / Project Coordinator

ChatGPT will act as the project coordinator and technical guide.

Responsibilities include:

- Clarifying requirements
- Breaking requirements into tasks
- Creating prompts for Claude and OpenCode
- Reviewing AI-generated solutions
- Debugging problems
- Making architectural decisions
- Maintaining alignment with this specification
- Planning deployment
- Helping document the project

The goal is to prevent the project from becoming an uncoordinated collection of AI-generated code.

---

# 24. Git Strategy

Git should be used from the beginning.

Potential commit progression:

```text
chore: initialize Next.js project

feat: create notes layout

feat: implement note creation

feat: implement note editing

feat: implement note deletion

feat: add local persistence

feat: add search

feat: add tags

feat: add theme system

feat: add markdown editor

fix: improve mobile note layout

fix: improve keyboard navigation
```

Commit messages may change depending on actual implementation.

The goal is to maintain a clean and understandable history.

---

# 25. Deployment Strategy

The target deployment pipeline is:

```text
Local Development
       ↓
      Git
       ↓
    GitHub
       ↓
     Vercel
       ↓
  Production
```

## Deployment Steps

When the application is ready:

1. Create the GitHub repository.
2. Push the project.
3. Create/connect the Vercel project.
4. Configure the deployment.
5. Deploy.
6. Test the production deployment.
7. Resolve production-specific issues.
8. Perform responsive QA.
9. Continue using GitHub-to-Vercel automatic deployments.

The user is new to Vercel, so deployment should be handled as a guided step-by-step process.

---

# 26. V1 Success Criteria

V1 should only be considered complete when the following areas are sufficiently addressed.

## 26.1 Functionality

- [ ] Create notes
- [ ] Edit notes
- [ ] Delete notes
- [ ] View notes
- [ ] Search notes
- [ ] Pin notes
- [ ] Tags
- [ ] Markdown
- [ ] Persistent local storage
- [ ] Theme selection
- [ ] Custom accent color

## 26.2 UX

- [ ] Desktop layout works
- [ ] Tablet layout works
- [ ] Mobile layout works
- [ ] Empty states exist
- [ ] Error states exist
- [ ] Destructive actions have safeguards
- [ ] Keyboard navigation works
- [ ] Main actions provide feedback

## 26.3 Accessibility

- [ ] Semantic structure
- [ ] Keyboard accessibility
- [ ] Visible focus states
- [ ] Contrast checked
- [ ] Forms properly labeled

## 26.4 Engineering

- [ ] TypeScript
- [ ] Reusable components
- [ ] Clean architecture
- [ ] Minimal duplicated logic
- [ ] Clean Git history
- [ ] README completed

## 26.5 Deployment

- [ ] GitHub repository
- [ ] Vercel deployment
- [ ] Production build succeeds
- [ ] Production application tested
- [ ] Responsive production QA completed

---

# 27. Future Roadmap

The application can evolve through multiple versions.

```text
V1
Core Notes
   ↓
V2
Advanced Notebook Customization
   ↓
V3
Notion-like Workspace / Pages
   ↓
V4
Authentication + Cloud Sync
   ↓
V5
Collaboration
   ↓
V6
AI Features
```

## V2 — Advanced Notebook Customization

Potential features:

- Custom page backgrounds
- Lined/grid/dotted pages
- Custom fonts
- Notebook styles
- Journal styles
- Custom icons
- Covers
- Decorative elements
- Drag-and-drop organization

## V3 — Notion-like Workspace

Potential features:

- Nested pages
- Subpages
- Block-based editing
- Drag-and-drop blocks
- Databases
- Tables
- Kanban boards
- Calendar views
- Templates
- Workspaces

## V4 — Cloud Application

Potential features:

- Authentication
- Supabase
- PostgreSQL
- Cloud synchronization
- User accounts
- Cross-device access

## V5 — Collaboration

Potential features:

- Shared pages
- Real-time editing
- Comments
- Collaboration
- Permissions
- Sharing links
- Version history

## V6 — AI

Potential features:

- AI writing assistance
- Summarization
- Note organization
- AI-powered search
- Semantic search
- Automatic tagging
- Content generation

## Additional Future Capabilities

Other possible future functionality includes:

- File attachments
- Export/import
- Offline support
- Progressive Web App functionality
- Advanced search
- Version history

---

# 28. Scope Management Rule

Feature creep must be actively controlled.

Whenever a new feature is proposed, classify it as one of:

### Must Have

Required for V1.

### Should Have

Useful and important, but V1 can ship without it.

### Could Have

A useful future enhancement.

### Future

Explicitly outside the current development scope.

A feature should not be added to V1 simply because it sounds interesting.

The goal is to finish a polished product rather than continuously expanding an unfinished one.

---

# 29. Final Product Direction

The desired product experience can be summarized as:

> **Notion's flexibility + a physical notebook's personality + modern SaaS quality.**

However, the engineering objective is equally important:

> **A well-architected, responsive, accessible, production-deployed application that demonstrates the ability to build, maintain, and evolve real software.**

The application should be visually interesting enough to stand out in a portfolio while maintaining enough engineering depth to support meaningful technical discussions during interviews.

---

# 30. Current Status and Next Step

## Current Status

**Project:** Notable  
**Project Number:** #1  
**Specification:** v1.0  
**Status:** Ready for Implementation Planning

### Current decisions

| Area | Decision |
|---|---|
| Project type | Personal notes / workspace application |
| Product direction | Notion-inspired, notebook/journal-focused |
| Authentication | No authentication in V1 |
| Database | No database in V1 |
| Persistence | localStorage |
| Markdown | Required |
| Light mode | Required |
| Dark mode | Required |
| Custom themes | Required |
| Custom accent colors | Required |
| Responsive design | Required |
| Accessibility | Required |
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Version control | Git + GitHub |
| AI development | Claude + OpenCode |
| Deployment | Vercel |

## Next Phase

The next step is:

### **Phase 2 — Technical Implementation Plan**

This phase will define:

- Exact Next.js initialization
- Dependencies
- Architecture
- Component hierarchy
- TypeScript types
- Data structures
- State management approach
- Storage abstraction
- Theme architecture
- Markdown implementation
- Development tasks
- Git workflow
- Claude responsibilities
- OpenCode responsibilities
- Initial prompts/tasks
- Vercel preparation

Only after the technical implementation plan is established should we initialize and begin coding the application.

---

## Document Control

**Document:** Notable — Project Specification  
**Version:** 1.0  
**Project:** Portfolio Side Project #1  
**Status:** Approved for Implementation Planning  
**Primary Local Path:** `Portfolio Projects/Notes-App`

Future revisions should increment the version number and document significant changes to scope or architecture.
