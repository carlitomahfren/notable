# Notable — Future Feature Ideas & Portfolio Closeout

This document records potential features for future versions of Notable and the checklist for officially closing the current version as a portfolio project.

**Current decision:** Freeze the current feature scope. Do not implement the ideas below during portfolio closeout. Revisit them only when there is a clear user need or a deliberate future release.

---

## Part 1: Future Feature Ideas

These are optional ideas, not commitments or requirements.

### 1. Note Templates
Provide reusable templates for meeting minutes, daily journals, study notes, project plans, brainstorming, and weekly reviews. Users can create a note from a template rather than starting from a blank page.

**Potential value:** Makes note creation faster and supports different writing workflows.

### 2. Trash and Note Recovery
Move deleted notes into a Trash view instead of removing them immediately. Let users restore notes, permanently delete individual notes, or empty the trash.

**Potential value:** Protects users from accidental deletion and improves data safety.

### 3. Command Palette
Provide a keyboard-accessible command menu for creating notes, switching themes, opening settings, and navigating between views. It should complement existing shortcuts rather than duplicate them unnecessarily.

**Potential value:** Makes common actions faster for keyboard-focused users.

### 4. Import Notes
Allow users to import Markdown and supported text files, with validation and a preview before importing.

**Potential value:** Makes it easier to move existing notes into Notable and complements the current export functionality.

### 5. Backup and Restore
Allow users to back up their notes and relevant metadata to a file and restore them later. Include validation, duplicate handling, and confirmation steps to reduce the risk of accidental data loss.

**Potential value:** Improves portability and gives users a way to recover their data.

### 6. Linked Notes and Backlinks
Let users link one note to another and see which notes reference the current note.

**Potential value:** Supports lightweight knowledge management without requiring a full workspace redesign.

### 7. Note Version History
Keep previous versions of a note so users can inspect or restore an earlier revision.

**Potential value:** Helps recover from unwanted edits, especially in long-form writing.

### 8. Notebooks and Collections
Let users group notes into notebooks or collections, potentially with optional nesting. This could help separate school, personal, and project notes.

**Potential value:** Provides a more structured organization system as a user's notes grow.

### 9. Reminders and Daily Notes
Allow optional reminders on notes and automatically create a daily note.

**Potential value:** Extends Notable into personal planning, journaling, and routine tracking.

### 10. Writing Statistics and Focus Mode
Display statistics such as word count, character count, estimated reading time, and writing goals. A distraction-free mode could hide secondary controls while keeping the editor usable.

**Potential value:** Supports longer writing sessions and helps users understand their writing progress.

### Additional ideas for a later major release

These were discussed as larger expansions rather than small finishing touches:

- **Installable PWA and offline improvements:** Make Notable installable as a desktop/mobile-style app, with appropriate icons and carefully tested offline caching and update behavior.
- **Cloud sync and cross-device access:** Add authentication and synchronization across devices. This would require backend storage, conflict resolution, and careful data-security decisions.

These additional ideas are recorded for completeness; the main list above contains the ten feature ideas.

---

## Part 2: Official Portfolio Closeout Checklist

**Goal:** Finish and present the existing Notable application as a portfolio project without expanding its feature scope.

Mark an item complete only after the corresponding work has actually been verified.

- [ ] **1. Verify the production deployment**
  - Open the live application and confirm it loads correctly.
  - Verify the splash animation and its transition into the app.
  - Check note creation, editing, persistence, deletion, and navigation.
  - Check themes and custom accent colors.
  - Verify exports and key responsive layouts on mobile and desktop.
  - Record any genuine production defects that need fixing.

- [ ] **2. Finalize the GitHub repository**
  - Confirm the latest intended changes are committed and pushed.
  - Check that the working tree is clean.
  - Confirm the main branch is synchronized with its upstream.
  - Ensure no secrets, environment files, or unrelated artifacts were committed.

- [ ] **3. Polish the README**
  - Explain the problem Notable solves and its intended users.
  - Summarize the main features.
  - Document the technology stack and high-level architecture.
  - Include setup and installation instructions.
  - Include available test, typecheck, lint, and build commands.
  - Document relevant design decisions and known limitations.
  - Add the live demo link and screenshots when ready.

- [ ] **4. Capture portfolio screenshots**
  - Capture polished desktop and mobile layouts.
  - Show the editor and rich-text formatting.
  - Show note organization, search, tags, and pinned notes.
  - Show theme customization.
  - Use genuine screenshots of the deployed or verified application.

- [ ] **5. Record a short demo**
  - Prepare a concise walkthrough of the app's strongest workflows.
  - Demonstrate creating and editing a note.
  - Show search, organization, themes, and export.
  - Keep the video focused and avoid spending too long on routine clicks.
  - Verify the recording is clear and the displayed app works correctly.

- [ ] **6. Prepare the resume entry**
  - Write a concise project description.
  - Highlight relevant engineering decisions and implementation work.
  - Mention the technologies actually used.
  - Include measurable claims only when they can be supported.
  - Add the repository and live demo links.
  - Prepare to explain architecture, accessibility, testing, and trade-offs in an interview.

---

## Definition of Done

Notable is ready to be marked complete as a portfolio project when all six closeout checklist items have been completed or any remaining limitations have been explicitly documented.

The feature scope stays frozen during closeout. Fix genuine defects if discovered, but do not add new features merely to extend the project.

Future feature ideas remain a backlog, not a promise to implement them.

## Suggested project status

- **Feature development:** Frozen
- **Portfolio closeout:** In progress
- **Future enhancements:** Backlog
- **Next step:** Begin production verification, then proceed through the six closeout checklist items.
