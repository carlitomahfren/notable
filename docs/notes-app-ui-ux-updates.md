# Notable UI/UX Updates

## 1. Expanded Writing View

### Current behavior

The current expand/enlarge button expands the editor into a page-level
view.

### Requested behavior

The enlarge button should instead open a **modal/dialog-style expanded
writing view**, similar to the existing Personalize dialog.

The popup should contain: - The rich-text formatting toolbar - The
writing/editing area - Existing Edit/Preview controls where
appropriate - A clear close/minimize control

The rest of Notable should remain visible behind a subtle
backdrop.

The expanded view should provide substantially more writing space,
especially on desktop, while preserving the same note, cursor/selection,
formatting state, undo/redo history, and autosave behavior.

Closing the popup must return the user to the normal editor without
losing content or formatting.

It must work on desktop, tablet, and mobile. On smaller screens it may
use most or all of the viewport, but it should still behave as a
temporary dialog-style writing workspace rather than simply changing the
entire page layout.

### Acceptance criteria

-   [ ] Enlarge button is subtle and accessible.
-   [ ] Clicking it opens a dialog/modal-style writing view.
-   [ ] Toolbar and writing area are contained in the expanded view.
-   [ ] Rich-text formatting continues to work.
-   [ ] Autosave continues to work.
-   [ ] Close and Escape work.
-   [ ] Focus is handled accessibly.
-   [ ] Desktop and mobile layouts work correctly.

## 2. Tags Workspace / Navigation Flow

### Current behavior

The current Tags flow requires the user to: 1. Press **Tags**. 2. See a
box containing existing tags. 3. Select a tag. 4. Only then see the
actual tag-filtered notes workspace.

This makes Tags feel like an intermediate selection screen instead of a
real workspace.

### Requested behavior

Pressing the **Tags** navigation tab should immediately open the Tags
workspace.

The initial state should show **all notes**, regardless of whether they
have tags.

The Tags workspace should contain: - A clear Tags section/header. - A
tag filter dropdown. - An **All Tags** default option. - Existing tags
as dropdown options. - The notes list/workspace below the filter.

### Default state

When entering Tags:

**Filter: All Tags**

All notes should initially be displayed.

### Filtering

Selecting a specific tag should display only notes containing that tag.

Selecting **All Tags** again should restore all notes.

Example:

``` text
Tags
  ↓
Tags workspace opens
  ↓
Filter: All Tags
  ↓
All notes displayed
  ↓
Open dropdown
  ↓
Select #School
  ↓
Only #School notes displayed
```

The Tags navigation item should represent a real workspace/view, not
merely a gateway to a list of tags.

The flow must work on desktop, tablet, and mobile.

## 3. Implementation Constraints

These are UI/UX improvements and should not change the core
architecture.

Do not change: - The `Note` data model - Markdown persistence -
Tiptap/ProseMirror architecture - Autosave behavior - Note CRUD -
Search - Pin/unpin - Bulk selection/deletion - Export - Themes

Use existing design tokens and components where possible. Avoid
unnecessary architectural complexity.

## 4. Overall Status

**Core functionality:** Complete

**Remaining UI/UX improvements:** Expanded Writing View + Tags Workspace
flow

**Next milestone:** GitHub publication and Vercel deployment
