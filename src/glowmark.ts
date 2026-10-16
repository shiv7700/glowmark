import { asGlobal, findMatches, type Rule } from './match.js';
import { createTooltip } from './tooltip.js';

const TOOLTIP_SELECTOR = '.glowmark-tooltip';
// Text inside these is code, form state or a glowmark tooltip, not readable content.
const SKIP_SELECTOR = `script, style, textarea, ${TOOLTIP_SELECTOR}`;
const BASE_NAME = 'glowmark';

type Opener = 'pointer' | 'caret';

interface Entry {
  range: Range;
  rule: Rule;
  groups: string[];
}

/**
 * Highlights rule matches in the text inside `root` and shows each rule's tooltip on hover, on tap,
 * and when the text cursor is inside a match.
 * The DOM is never changed: matches are painted with the CSS Custom Highlight API.
 * Highlights follow later content changes automatically.
 * Returns a function that removes the highlights, listeners and tooltip.
 */
export function glowmark(root: HTMLElement, rules: Rule[]): () => void {
  const doc = root.ownerDocument;
  const globalRules = rules.map((rule) => ({ ...rule, pattern: asGlobal(rule.pattern) }));
  const tooltip = createTooltip(doc);
  let entries: Entry[] = [];
  let active: Entry | null = null;
  // What opened the tooltip, so the pointer doesn't close one the text cursor opened, and vice versa.
  let openedBy: Opener | null = null;

  const hide = () => {
    active = null;
    openedBy = null;
    tooltip.hide();
  };

  const show = (entry: Entry, rect: DOMRect, by: Opener) => {
    if (entry === active) {
      // The text cursor is the steadier anchor: once it is in the match, moving the mouse away keeps the tooltip.
      if (by === 'caret') openedBy = 'caret';
      return;
    }
    const text = entry.rule.tooltip?.({ text: entry.range.toString(), groups: entry.groups });
    if (!text) {
      // A match without a tooltip only closes a tooltip that was opened the same way.
      if (!openedBy || openedBy === by) hide();
      return;
    }
    active = entry;
    openedBy = by;
    tooltip.show(text, rect);
  };

  const scan = () => {
    hide();
    unpaint(doc, entries);
    entries = findEntries(root, globalRules);
    paint(doc, entries);
    // The ranges were rebuilt, so reopen the text cursor's tooltip in the same task: no flicker while typing.
    onSelectionChange();
  };

  // Painted ranges are not elements, so hover and tap are found by hit-testing the pointer.
  const onPointer = (e: MouseEvent) => {
    const hit = entryAt(entries, e);
    if (hit) show(hit.entry, hit.rect, 'pointer');
    else if (openedBy === 'pointer') hide();
  };

  const onLeave = () => {
    if (openedBy === 'pointer') hide();
  };

  // Pressing anywhere outside root (or a shadow root inside it) closes the tooltip.
  const onPointerDownOutside = (e: Event) => {
    if (!e.composedPath().includes(root)) hide();
  };

  // Keyboard users (editors, caret browsing) open a tooltip by moving the text cursor into a match.
  const onSelectionChange = () => {
    const selection = doc.getSelection();
    const caret = selection?.rangeCount && selection.isCollapsed ? selection.getRangeAt(0) : null;
    const entry =
      caret && root.contains(caret.startContainer)
        ? entries.find((e) => isInside(e.range, caret.startContainer, caret.startOffset))
        : undefined;
    if (entry) show(entry, entry.range.getClientRects()[0] ?? entry.range.getBoundingClientRect(), 'caret');
    else if (openedBy === 'caret') hide();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  // Rescan on content changes, but not on any glowmark tooltip's text changes.
  const observer = new MutationObserver((records) => {
    if (records.some((r) => !isInTooltip(r.target))) scan();
  });

  scan();
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  root.addEventListener('mousemove', onPointer);
  root.addEventListener('mouseleave', onLeave);
  // A tap fires click. Listening on root itself matters: iOS Safari doesn't send taps on plain text up to document.
  root.addEventListener('click', onPointer);
  doc.addEventListener('pointerdown', onPointerDownOutside);
  doc.addEventListener('selectionchange', onSelectionChange);
  doc.addEventListener('keydown', onKeydown);
  // shortcut: hides on scroll instead of following the match; track position if users ask for it.
  doc.addEventListener('scroll', hide, { capture: true, passive: true });

  return () => {
    observer.disconnect();
    root.removeEventListener('mousemove', onPointer);
    root.removeEventListener('mouseleave', onLeave);
    root.removeEventListener('click', onPointer);
    doc.removeEventListener('pointerdown', onPointerDownOutside);
    doc.removeEventListener('selectionchange', onSelectionChange);
    doc.removeEventListener('keydown', onKeydown);
    doc.removeEventListener('scroll', hide, { capture: true });
    unpaint(doc, entries);
    entries = [];
    tooltip.element.remove();
  };
}

/** Strictly inside: a text cursor right before or after a match is next to it, not in it. */
function isInside(range: Range, node: Node, offset: number): boolean {
  return (
    range.comparePoint(node, offset) === 0 &&
    !(node === range.startContainer && offset === range.startOffset) &&
    !(node === range.endContainer && offset === range.endOffset)
  );
}

const isInTooltip = (node: Node) =>
  !!(node instanceof Element ? node : node.parentElement)?.closest(TOOLTIP_SELECTOR);

function findEntries(root: HTMLElement, rules: Rule[]): Entry[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const entries: Entry[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest(SKIP_SELECTOR)) continue;
    for (const { start, end, rule, groups } of findMatches(node.data, rules)) {
      const range = doc.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      entries.push({ range, rule, groups });
    }
  }
  return entries;
}

function entryAt(entries: Entry[], e: MouseEvent): { entry: Entry; rect: DOMRect } | null {
  for (const entry of entries) {
    // Cheap filter: the pointer is over the element that directly holds the matched text.
    if (entry.range.startContainer.parentNode !== e.target) continue;
    for (const rect of entry.range.getClientRects()) {
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inside) return { entry, rect };
    }
  }
  return null;
}

// Every range goes in the shared "glowmark" highlight (default look) and in "glowmark-<rule>"
// (per-rule look, painted on top). The registry is page-wide and shared by every glowmark
// instance, so each instance only adds and removes its own ranges.
const highlightNames = (rule: Rule) => [BASE_NAME, `${BASE_NAME}-${rule.name}`];

function paint(doc: Document, entries: Entry[]): void {
  const api = highlightApi(doc);
  if (!api) return;
  for (const { range, rule } of entries) {
    for (const name of highlightNames(rule)) {
      let highlight = api.registry.get(name);
      if (!highlight) {
        highlight = new api.Highlight();
        highlight.priority = name === BASE_NAME ? 0 : 1;
        api.registry.set(name, highlight);
      }
      highlight.add(range);
    }
  }
}

function unpaint(doc: Document, entries: Entry[]): void {
  const api = highlightApi(doc);
  if (!api) return;
  for (const { range, rule } of entries) {
    for (const name of highlightNames(rule)) {
      const highlight = api.registry.get(name);
      highlight?.delete(range);
      if (highlight?.size === 0) api.registry.delete(name);
    }
  }
}

// Uses the root's own window, so a root inside an iframe paints in that iframe.
// Browsers without the API show no colors, but tooltips still work.
function highlightApi(doc: Document) {
  const view = doc.defaultView;
  return view && typeof view.Highlight === 'function' && view.CSS?.highlights
    ? { registry: view.CSS.highlights, Highlight: view.Highlight }
    : null;
}
