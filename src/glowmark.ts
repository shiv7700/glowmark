import { asGlobal, findMatches, type Rule } from './match.js';
import { createTooltip } from './tooltip.js';

const TOOLTIP_SELECTOR = '.glowmark-tooltip';
// Text inside these is code, form state or a glowmark tooltip, not readable content.
const SKIP_SELECTOR = `script, style, textarea, ${TOOLTIP_SELECTOR}`;
const BASE_NAME = 'glowmark';

interface Entry {
  range: Range;
  rule: Rule;
  groups: string[];
}

/**
 * Highlights rule matches in the text inside `root` and shows each rule's tooltip on hover.
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

  const hide = () => {
    active = null;
    tooltip.hide();
  };

  const scan = () => {
    hide();
    unpaint(doc, entries);
    entries = findEntries(root, globalRules);
    paint(doc, entries);
  };

  // Painted ranges are not elements, so hover is found by hit-testing the pointer.
  const onMove = (e: MouseEvent) => {
    const hit = entryAt(entries, e);
    if (hit?.entry === active) return;
    const text = hit?.entry.rule.tooltip?.({ text: hit.entry.range.toString(), groups: hit.entry.groups });
    if (!hit || !text) return hide();
    active = hit.entry;
    tooltip.show(text, hit.rect);
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
  root.addEventListener('mousemove', onMove);
  root.addEventListener('mouseleave', hide);
  doc.addEventListener('keydown', onKeydown);
  // shortcut: hides on scroll instead of following the match; track position if users ask for it.
  doc.addEventListener('scroll', hide, { capture: true, passive: true });

  return () => {
    observer.disconnect();
    root.removeEventListener('mousemove', onMove);
    root.removeEventListener('mouseleave', hide);
    doc.removeEventListener('keydown', onKeydown);
    doc.removeEventListener('scroll', hide, { capture: true });
    unpaint(doc, entries);
    entries = [];
    tooltip.element.remove();
  };
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
