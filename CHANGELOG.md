# Changelog

## 0.2.0 (2026-10-16)

- New `words(list, options)` preset for search highlighting. It matches literal text, ignores case by default, prefers longer terms, and ignores blank terms.

## 0.1.1 (2026-10-16)

- Export `glowmark/package.json`, so tools that read a package's metadata can find it.

## 0.1.0 (2026-10-16)

First version.

- `glowmark(root, rules)` highlights rule matches in the text inside `root` **without changing the DOM**. It uses the CSS Custom Highlight API, shows tooltips on hover, and updates automatically when the content changes.
- `mustache()` and `template()` preset rules.
- Optional `style.css` with colors and the tooltip look, themed with CSS custom properties.
