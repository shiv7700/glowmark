# Decisions

This is a log of design decisions: what we chose and why. Add new entries at the bottom and never rewrite old ones. If a decision changes, add a new entry that says which one it replaces.

---

### D1. Name: `glowmark` (2026-10-16)

We wanted something catchy. It was free on npm on 2026-10-16. Other names considered: halomark, neonmark, glimmr, tiplight, marktip.

### D2. One zero-dependency package with no framework adapters (2026-10-16)

The work is just parsing a string and reacting to DOM events, which the browser already provides. Every framework can render an HTML string and give you a container element, so a React or Vue adapter would only wrap two function calls. We considered a monorepo with `@glowmark/core` and `@glowmark/react` and rejected it: it means more tooling with no real benefit. Framework usage goes in the README examples instead.

### D3. String in, string out for `highlight()` (2026-10-16)

The alternative was changing a live DOM element in place. That conflicts with frameworks that own their DOM (React re-rendering would undo it). A string fits every framework's "render raw HTML" feature, and it's easy to test.

### D4. Parse with `<template>`, not regex on raw HTML (2026-10-16)

Running regex replace on raw HTML breaks on matches inside attributes, in `<script>`, or spanning tags. Walking only text nodes is correct. `<template>` keeps fragments as written (DOMParser would drop a stray `<td>` outside a table) and is inert.

### D5. One delegated tooltip with built-in positioning, not Floating UI or Tippy (2026-10-16)

A page can have hundreds of highlights, so we use one tooltip element and one listener set instead of one instance per highlight. Positioning (above, flip below, clamp to the viewport) is about 10 lines, which isn't worth adding a dependency (see D2). Known limit: the tooltip hides on scroll instead of following the highlight. If users ask for that, reconsider Floating UI.

### D6. No built-in sanitizer (2026-10-16)

If the input HTML is untrusted, rendering it is unsafe whether or not glowmark touches it. Bundling DOMPurify (~20 kB) would penalize users whose HTML is already trusted. Instead, the README shows `highlight(DOMPurify.sanitize(html), rules)`. glowmark only promises that the text *it* inserts (matched text and tooltip text) can never become HTML.

### D7. Use `<mark>` as the highlight element (2026-10-16)

`<mark>` is the semantic HTML element for highlighted text, and it shows a visible highlight even without our CSS.

### D8. Overlaps: earliest start wins, then rule order (2026-10-16)

This is simple and predictable, and users control priority through the order of the rules array. "Longest match wins" was considered and left out until someone needs it.

### D9. An empty tooltip string means no tooltip (2026-10-16)

This lets one rule show a tooltip for some matches and not others, with no extra option. It also avoids showing an empty tooltip bubble.

### D10. Tooling: `tsc` + Vitest/jsdom, ESM only (2026-10-16)

A library made of plain modules doesn't need a bundler. `tsc` emits JS and `.d.ts` files. Every current bundler and framework handles ESM, so we don't ship CommonJS. jsdom covers the logic, and tooltip positioning is checked in a real browser through `examples/`.

### D11. Paint matches instead of wrapping them (2026-10-16). Replaces D3, D4 and D7; updates D5.

The requirement is that the user's HTML stays exactly as they rendered it, with no `<mark>` or `<span>` added. glowmark now:

- **Doesn't produce HTML.** The caller's framework renders the content as usual, whether that's HTML or a plain string. Then `glowmark(root, rules)` attaches to the element. This replaces the `highlight()` / `tooltips()` pair.
- **Paints matches with the CSS Custom Highlight API.** Each match is a `Range` added to `CSS.highlights`, so no element is created.
- **Finds hover by hit-testing.** `mousemove` checks the pointer against each range's client rects, because ranges can't receive events.
- **Rescans with a `MutationObserver`**, so highlights follow re-renders without the caller doing anything.

Trade-offs we accepted:
- **Tooltips are mouse-only.** With no element there's nothing to focus, so there's no keyboard access and no `aria-describedby`.
- **Styling is limited.** Only `color`, `background-color`, `text-decoration` and `text-shadow` work inside `::highlight()`.
- **Older browsers show no colors.** Browsers without the API (before Chrome 105, Safari 17.2 or Firefox 140) don't paint. Tooltips still work there.

The alternative was wrapping only the matches that have tooltips (in a `span`, keeping keyboard access). We rejected it because the HTML would still change for those matches.

### D12. A shared `glowmark` highlight under each per-rule highlight (2026-10-16)

`::highlight()` has no default style and no wildcard selector, so a custom rule with no CSS would be invisible. Every range is added to `glowmark` (priority 0, styled by `style.css`) and to `glowmark-<name>` (priority 1, drawn on top). Custom rules are visible by default and can still be styled one by one.

### D13. Compute tooltip text on hover (2026-10-16)

`rule.tooltip()` is called when a match is hovered, not when it's found. Tooltips then always read the caller's latest data (for example a lookup table that changes) without a rescan, and matches that are never hovered cost nothing.
