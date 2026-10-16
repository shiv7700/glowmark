# Architecture

glowmark never changes the DOM. It finds matches in the text that's already rendered, asks the browser to paint them, and shows a tooltip by checking where the mouse is.

```
your framework renders content into root
              │
              ▼
glowmark(root, rules)
  ├─ scan: walk text nodes → find matches → one Range per match → add to CSS.highlights
  ├─ MutationObserver on root → rescan when content changes
  └─ mousemove on root → is the pointer over a Range? → show or hide the one shared tooltip
```

## Files

| File               | Responsibility                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| `src/match.ts`     | `Rule` and `Match` types. `findMatches(text, rules)` is pure string logic, with no DOM. |
| `src/glowmark.ts`  | `glowmark()`: scanning, painting, rescanning on changes, hover hit-testing, cleanup. |
| `src/tooltip.ts`   | The single tooltip element and its positioning.                                |
| `src/rules.ts`     | The `mustache()` and `template()` presets.                                     |
| `src/index.ts`     | Public exports.                                                                |

## Scan (`findEntries` + `paint`)

1. A `TreeWalker` visits every text node under `root`. It skips any inside `script`, `style`, `textarea`, or glowmark's own tooltip.
2. `findMatches` runs every rule's regex on the node's text and drops empty matches. It sorts by start position, with rule order breaking ties, and keeps only the matches that don't overlap the one before.
3. Each match becomes a DOM `Range` over that text node. Ranges are not elements, so the DOM is unchanged.
4. Each range is added to two highlights in `CSS.highlights`:
   - `glowmark`, with priority 0. This is the default look, so custom rules are visible without extra CSS.
   - `glowmark-<rule.name>`, with priority 1. This is the per-rule look, painted on top.

`CSS.highlights` is shared by the whole page, and other glowmark instances may use the same names. So each instance only adds and deletes **its own** ranges, and a highlight is removed from the registry only once it's empty.

The API is taken from the root's own window (`root.ownerDocument.defaultView`), so a root inside an iframe paints in that iframe. If the browser lacks the API (`Highlight` or `CSS.highlights`), painting is skipped. The ranges are still built, so tooltips keep working.

## Changes (`MutationObserver`)

Observes `root` with `childList`, `subtree` and `characterData`. Any change causes a full rescan (unpaint the old ranges, then scan and paint again). Changes inside any glowmark tooltip are ignored, including tooltips that belong to other instances. This matters when `root` is `document.body`, where the tooltips live.

## Hover (`entryAt`)

On `mousemove`, the ranges are checked against the pointer:

- **Cheap filter first:** a range is only considered if its text node's parent is `event.target`, the element directly under the pointer.
- **Then** each of the range's `getClientRects()` is checked for the pointer position. A match that wraps across lines has one rect per line. The tooltip anchors to the line where the pointer first entered the match.
- The tooltip text is computed **on hover** by calling `rule.tooltip(match)`, so it always reflects the caller's latest data. An empty string means no tooltip.
- If the same match is hovered again, nothing happens. This avoids re-rendering on every mouse move.

The tooltip hides on: the pointer moving off a match, `mouseleave` on root, Escape, any scroll, and every rescan.

## Tooltip (`tooltip.ts`)

There's one `<div class="glowmark-tooltip" role="tooltip">` per `glowmark()` call, appended to `document.body` and positioned with `position: fixed`. It goes above the hovered rect, flips below if there's no room, and is centered horizontally but clamped inside the viewport. Its text is set with `textContent`, so tooltip text can never become HTML.
