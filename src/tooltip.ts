const GAP = 6;

export interface Tooltip {
  element: HTMLElement;
  show(text: string, anchor: DOMRect): void;
  hide(): void;
}

/** Creates one hidden tooltip element on `doc.body`. The caller removes `element` when done. */
export function createTooltip(doc: Document): Tooltip {
  const element = doc.createElement('div');
  element.className = 'glowmark-tooltip';
  element.setAttribute('role', 'tooltip');
  element.hidden = true;
  doc.body.append(element);

  return {
    element,
    show(text, anchor) {
      element.textContent = text;
      element.hidden = false;
      position(element, anchor);
    },
    hide() {
      element.hidden = true;
    },
  };
}

/** Places the tooltip above `anchor`, or below if there is no room, kept inside the viewport. */
function position(tip: HTMLElement, anchor: DOMRect): void {
  const viewportWidth = tip.ownerDocument.documentElement.clientWidth;
  // Measure at the origin: at the previous position the width would shrink to fit the space left.
  Object.assign(tip.style, { position: 'fixed', top: '0px', left: '0px' });
  const { offsetWidth: width, offsetHeight: height } = tip;

  const above = anchor.top - height - GAP;
  const top = above >= 0 ? above : anchor.bottom + GAP;
  const centered = anchor.left + anchor.width / 2 - width / 2;
  const left = Math.max(GAP, Math.min(centered, viewportWidth - width - GAP));

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}
