import {
  type MarkdownIt as MarkdownItParser,
  type StateCore,
  type Token,
} from "markdown-it"

/**
 * GitHub-style task lists, which CommonMark and markdown-it both leave out.
 *
 * Without this, `- [ ] milk` is a bullet whose text happens to begin with a
 * bracketed character, and the note would greet its author with `[ ] milk` the first
 * time they opened it. That is the one piece of Markdown the editor has to
 * understand itself rather than through a plugin.
 *
 * The output is the markup Tiptap's task list parses: a `ul` and its `li`s carrying
 * `data-type`, and the state on `data-checked`. Nothing about the checkbox itself is
 * written here, because the editor draws its own.
 */
const TASK_MARKER = /^\[([ xX])\]\s+/

export function taskLists(md: MarkdownItParser): void {
  md.core.ruler.after("inline", "note_task_lists", (state: StateCore) => {
    const tokens = state.tokens
    // The token stream is flat and nesting is expressed by level, so a stack of the
    // open containers is all it takes to know which list an item belongs to.
    const open: Token[] = []

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]

      if (token === undefined) {
        continue
      }

      if (token.type === "list_item_open") {
        markTaskItem(state, token, tokens, index, open[open.length - 1])
      }

      if (token.nesting === 1) {
        open.push(token)
        continue
      }

      if (token.nesting === -1) {
        open.pop()
      }
    }
  })
}

/**
 * Turns one `- [ ] item` into a task item, and its list into a task list.
 *
 * A list becomes a task list as soon as one of its items is one: a task list may only
 * contain tasks, so a hand-written list that mixes `[ ]` with plain bullets becomes a
 * list of unchecked tasks rather than a task list with an error in it. Nothing is
 * dropped either way, and the author sees checkboxes instead of syntax.
 */
function markTaskItem(
  state: StateCore,
  item: Token,
  tokens: readonly Token[],
  index: number,
  list: Token | undefined,
): void {
  if (list?.type !== "bullet_list_open") {
    return
  }

  // The item's text is its own paragraph's inline token, which is not the next token
  // in the stream: an opening tag sits between the two. Staying inside the item's own
  // level is what keeps a nested list's text from being taken for this item's.
  const inline = nextInlineInside(tokens, index, item.level)

  if (inline === undefined) {
    return
  }

  const match = TASK_MARKER.exec(inline.content)

  if (match === null) {
    return
  }

  inline.content = inline.content.slice(match[0].length)
  // The children are the parsed form of the same text, so they are rebuilt from the
  // shortened source rather than patched: the marker can be split across several
  // inline tokens.
  inline.children = []
  state.md.inline.parse(inline.content, state.md, state.env, inline.children)

  item.attrSet("data-type", "taskItem")
  item.attrSet(
    "data-checked",
    (match[1] ?? " ").toLowerCase() === "x" ? "true" : "false",
  )
  list.attrSet("data-type", "taskList")
}

function nextInlineInside(
  tokens: readonly Token[],
  from: number,
  level: number,
): Token | undefined {
  for (let cursor = from + 1; cursor < tokens.length; cursor += 1) {
    const candidate = tokens[cursor]

    if (candidate === undefined || candidate.level <= level) {
      return undefined
    }

    if (candidate.type === "inline") {
      return candidate
    }
  }

  return undefined
}