# AGENTS.md

This is the guide for anyone working on this repo, human or AI agent. `CLAUDE.md` imports this file.

## What this is

**glowmark** is an npm package. It highlights pattern matches (like `{{x}}` and `${x}`) in already-rendered content and shows tooltips on them, **without changing the DOM**: matches are painted with the CSS Custom Highlight API. It has zero runtime dependencies and works with any frontend framework. For how it works, see [docs/architecture.md](docs/architecture.md). For why it's built this way, see [docs/decisions.md](docs/decisions.md).

## Commands

```sh
npm test            # vitest + jsdom
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
```

To try it in a real browser: run `npm run build`, serve the repo root (`python3 -m http.server`), and open `/examples/`.

## Layout

```
src/
  glowmark.ts    glowmark(root, rules) → destroy. Scan, paint, rescan on changes, hover hit-test.
  match.ts       the Rule and Match types, plus findMatches(text, rules) (pure, no DOM)
  tooltip.ts     the single tooltip element and its positioning
  rules.ts       built-in presets: mustache(), template()
  index.ts       public exports (the only entry point)
test/            one test file per source file
style.css        optional default styles, published as glowmark/style.css
examples/        demo page for manual browser checks
docs/            architecture, decision log, demo.png (README screenshot, regenerate from examples/)
.claude/agents/  Claude Code subagents for this repo
```

## Rules

These hold for every change.

1. **No runtime dependencies.** `dependencies` in package.json stays empty. Write the few lines yourself, or don't add the feature.
2. **No framework code.** Nothing imports React, Vue or similar. Framework usage belongs in README examples, not in `src/`.
3. **Never change the user's DOM.** No wrapping, no attributes, no text changes inside `root`. Matches are `Range`s in `CSS.highlights` (see D11 in docs/decisions.md).
4. **Never inject HTML from user data.** Tooltip text goes in through `textContent` only.
5. **Degrade, don't break.** Without the Highlight API, colors are skipped but tooltips still work. Escape and scroll always close the tooltip.
6. **Keep the API small.** Every new option needs a real use case. Say no by default.
7. **Tests cover behavior.** New behavior gets a test in `test/`. jsdom has no Highlight API and no layout, and the tests stub both. Painting and tooltip placement must be checked in `examples/` with a real browser.

## Code style

- TypeScript strict mode, ESM, and `.js` extensions in relative imports (required by NodeNext).
- Small named functions. Write a comment only when the code can't explain *why*.
- If you take a known shortcut, mark it: `// shortcut: <the limit>, <when to upgrade>`.

## Keeping docs current

Docs are part of the change, not a follow-up:

- **User-facing behavior changed?** Update `README.md` and `CHANGELOG.md`.
- **Made a design choice?** Add an entry to `docs/decisions.md`.
- **Moved or added files?** Update the layout above and `docs/architecture.md`.

## Git

Use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
