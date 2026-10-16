import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { glowmark, mustache, template } from '../src/index.js';

// jsdom has no CSS Custom Highlight API and no layout, so stand in for both.
class FakeHighlight extends Set<AbstractRange> {
  priority = 0;
}
const registry = new Map<string, FakeHighlight>();
const RECT = new DOMRect(10, 10, 50, 20);

const painted = (name: string) => [...(registry.get(name) ?? [])].map((r) => (r as Range).toString());
const tip = () => document.querySelector<HTMLElement>('.glowmark-tooltip')!;
const moveTo = (target: Element, x = 20, y = 15) =>
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
const flushMutations = () => new Promise((resolve) => setTimeout(resolve));

describe('glowmark', () => {
  let root: HTMLElement;
  let destroy: () => void;

  beforeEach(() => {
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights: registry });
    Range.prototype.getClientRects = () => [RECT] as unknown as DOMRectList;
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    destroy?.();
    root.remove();
    registry.clear();
    vi.unstubAllGlobals();
  });

  it('never changes the DOM', () => {
    const html = '<p class="x">Hi {{ name }}, order <b>${id}</b></p>';
    root.innerHTML = html;
    destroy = glowmark(root, [mustache({ tooltip: () => 'tip' }), template()]);
    expect(root.innerHTML).toBe(html);
  });

  it('paints matches in the shared and the per-rule highlight', () => {
    root.innerHTML = '<p>Hi {{ name }}, order <b>${id}</b></p>';
    destroy = glowmark(root, [mustache(), template()]);
    expect(painted('glowmark')).toEqual(['{{ name }}', '${id}']);
    expect(painted('glowmark-mustache')).toEqual(['{{ name }}']);
    expect(painted('glowmark-template')).toEqual(['${id}']);
    expect(registry.get('glowmark-mustache')!.priority).toBeGreaterThan(registry.get('glowmark')!.priority);
  });

  it('works with plain text content', () => {
    root.textContent = 'a < b and {{x}}';
    destroy = glowmark(root, [mustache()]);
    expect(painted('glowmark')).toEqual(['{{x}}']);
  });

  it('never matches attributes, script, style, textarea, or across tags', () => {
    root.innerHTML =
      '<a title="{{x}}">ok</a><script>"{{x}}"</script><style>/*{{x}}*/</style><textarea>{{x}}</textarea>{{a <b>b</b>}}';
    destroy = glowmark(root, [mustache()]);
    expect(painted('glowmark')).toEqual([]);
  });

  it('follows content changes', async () => {
    root.innerHTML = '{{a}}';
    destroy = glowmark(root, [mustache()]);
    root.innerHTML = '{{b}} {{c}}';
    await flushMutations();
    expect(painted('glowmark')).toEqual(['{{b}}', '{{c}}']);
  });

  it('shows the tooltip over a match and hides it elsewhere', () => {
    root.innerHTML = '<p>{{name}}</p><div>other</div>';
    destroy = glowmark(root, [mustache({ tooltip: (m) => `Variable: ${m.groups[0]}` })]);
    const [p, other] = root.children;

    moveTo(p);
    expect(tip().hidden).toBe(false);
    expect(tip().textContent).toBe('Variable: name');

    moveTo(p, 500, 500); // same element, outside the match
    expect(tip().hidden).toBe(true);

    moveTo(p);
    moveTo(other);
    expect(tip().hidden).toBe(true);
  });

  it('hides on Escape and on mouse leave', () => {
    root.innerHTML = '<p>{{name}}</p>';
    destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);

    moveTo(root.firstElementChild!);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tip().hidden).toBe(true);

    moveTo(root.firstElementChild!);
    root.dispatchEvent(new MouseEvent('mouseleave'));
    expect(tip().hidden).toBe(true);
  });

  it('shows the tooltip on tap (click) and hides it on a press outside', () => {
    root.innerHTML = '<p>{{name}}</p>';
    const outside = document.createElement('div');
    document.body.append(outside);
    destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);

    root.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 15 }));
    expect(tip().hidden).toBe(false);

    root.firstElementChild!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    expect(tip().hidden).toBe(false); // a press inside root keeps it

    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    expect(tip().hidden).toBe(true);
    outside.remove();
  });

  describe('text cursor', () => {
    const placeCaret = (node: Node, offset: number) => {
      document.getSelection()!.collapse(node, offset);
      document.dispatchEvent(new Event('selectionchange'));
    };

    it('opens the tooltip inside a match and keeps it when the mouse leaves', () => {
      root.innerHTML = '<p>Hi {{name}} there</p>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'caret tip' })]);
      const text = root.firstElementChild!.firstChild!;

      placeCaret(text, 5); // inside "{{name}}"
      expect(tip().hidden).toBe(false);
      expect(tip().textContent).toBe('caret tip');

      root.dispatchEvent(new MouseEvent('mouseleave'));
      moveTo(root.firstElementChild!, 500, 500); // pointer off every match
      expect(tip().hidden).toBe(false);

      placeCaret(text, 14); // in " there"
      expect(tip().hidden).toBe(true);
    });

    it('ignores a cursor right before or right after a match', () => {
      root.innerHTML = '<p>Hi {{name}} there</p>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);
      const text = root.firstElementChild!.firstChild!;
      placeCaret(text, 3); // "Hi |{{name}}"
      expect(tip().hidden).toBe(true);
      placeCaret(text, 11); // "{{name}}| there"
      expect(tip().hidden).toBe(true);
    });

    it('closes its tooltip when the cursor moves outside root', () => {
      const other = document.createElement('p');
      other.textContent = 'elsewhere';
      document.body.append(other);
      root.innerHTML = '<p>{{name}}</p>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);

      placeCaret(root.firstElementChild!.firstChild!, 3);
      expect(tip().hidden).toBe(false);
      placeCaret(other.firstChild!, 2);
      expect(tip().hidden).toBe(true);
      other.remove();
    });

    it('is not closed by hovering a match that has no tooltip', () => {
      root.innerHTML = '<p>{{name}}</p><div>${id}</div>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'caret tip' }), template()]);
      placeCaret(root.firstElementChild!.firstChild!, 3);
      moveTo(root.children[1]); // hovers ${id}, which has no tooltip
      expect(tip().hidden).toBe(false);
    });

    it('takes over a tooltip the pointer opened on the same match', () => {
      root.innerHTML = '<p>{{name}}</p>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);
      moveTo(root.firstElementChild!); // opened by pointer
      placeCaret(root.firstElementChild!.firstChild!, 3); // cursor into the same match
      moveTo(root.firstElementChild!, 500, 500); // pointer away
      expect(tip().hidden).toBe(false);
    });

    it('keeps its tooltip open across a content change', async () => {
      root.innerHTML = '<p>{{name}}</p>';
      destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);
      placeCaret(root.firstElementChild!.firstChild!, 3);
      await flushMutations(); // let any queued selectionchange run first
      root.append(document.createElement('p')); // triggers a rescan
      await Promise.resolve(); // the observer runs as a microtask, before any new selectionchange task
      expect(tip().hidden).toBe(false);
    });
  });

  it('removes every document listener it added', () => {
    const added: string[] = [];
    const removed: string[] = [];
    const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation(function (this: Document, type, ...rest) {
      added.push(type);
      return EventTarget.prototype.addEventListener.call(this, type, ...rest);
    });
    const removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(function (this: Document, type, ...rest) {
      removed.push(type);
      return EventTarget.prototype.removeEventListener.call(this, type, ...rest);
    });
    root.innerHTML = '<p>{{x}}</p>';
    glowmark(root, [mustache()])();
    addSpy.mockRestore();
    removeSpy.mockRestore();
    expect(removed.sort()).toEqual(added.sort());
    expect(added).toEqual(expect.arrayContaining(['pointerdown', 'selectionchange', 'keydown', 'scroll']));
  });

  it('shows nothing for a rule without a tooltip or with an empty one', () => {
    root.innerHTML = '<p>{{a}}</p><p>${b}</p>';
    destroy = glowmark(root, [mustache({ tooltip: () => '' }), template()]);
    moveTo(root.children[0]);
    expect(tip().hidden).toBe(true);
    moveTo(root.children[1]);
    expect(tip().hidden).toBe(true);
  });

  it('keeps tooltip text as text', () => {
    root.innerHTML = '<p>{{x}}</p>';
    destroy = glowmark(root, [mustache({ tooltip: () => '<img src=x onerror=alert(1)>' })]);
    moveTo(root.firstElementChild!);
    expect(tip().querySelector('img')).toBeNull();
    expect(tip().textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('does not highlight its own tooltip when attached to body', async () => {
    root.innerHTML = '<p>{{x}}</p>';
    destroy = glowmark(document.body, [mustache({ tooltip: () => '{{looks like a match}}' })]);
    moveTo(root.firstElementChild!);
    await flushMutations();
    expect(painted('glowmark')).toEqual(['{{x}}']);
  });

  it("does not rescan when another instance's tooltip changes", async () => {
    const other = document.createElement('div');
    other.innerHTML = '<p>{{b}}</p>';
    document.body.append(other);
    root.innerHTML = '<p>{{a}}</p>';
    const destroyOther = glowmark(other, [mustache({ tooltip: () => 'other tip' })]);
    destroy = glowmark(document.body, [mustache({ tooltip: () => 'body tip' })]);

    moveTo(root.firstElementChild!);
    moveTo(other.firstElementChild!); // other instance shows its tooltip
    await flushMutations();
    const bodyTip = [...document.querySelectorAll<HTMLElement>('.glowmark-tooltip')].find((t) => t.textContent === 'body tip')!;
    expect(bodyTip.hidden).toBe(false); // a rescan would have hidden it

    destroyOther();
    other.remove();
  });

  it('paints in the iframe that holds the root', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameRegistry = new Map<string, FakeHighlight>();
    Object.assign(iframe.contentWindow!, { Highlight: FakeHighlight, CSS: { highlights: frameRegistry } });
    const frameRoot = iframe.contentDocument!.body;
    frameRoot.textContent = '{{x}}';

    const destroyFrame = glowmark(frameRoot, [mustache()]);
    expect([...frameRegistry.get('glowmark')!].map(String)).toEqual(['{{x}}']);
    expect(registry.size).toBe(0);

    destroyFrame();
    iframe.remove();
  });

  it('only removes its own ranges when two instances share a rule', () => {
    const other = document.createElement('div');
    other.textContent = '{{b}}';
    document.body.append(other);
    root.textContent = '{{a}}';
    const destroyOther = glowmark(other, [mustache()]);
    destroy = glowmark(root, [mustache()]);

    destroyOther();
    other.remove();
    expect(painted('glowmark')).toEqual(['{{a}}']);
  });

  it('cleanup removes highlights, tooltip and listeners', () => {
    root.innerHTML = '<p>{{x}}</p>';
    destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);
    destroy();
    expect(registry.size).toBe(0);
    expect(document.querySelector('.glowmark-tooltip')).toBeNull();
    expect(() => moveTo(root.firstElementChild!)).not.toThrow();
  });

  it('still shows tooltips when the browser lacks the Highlight API', () => {
    vi.stubGlobal('Highlight', undefined);
    root.innerHTML = '<p>{{x}}</p>';
    destroy = glowmark(root, [mustache({ tooltip: () => 'tip' })]);
    moveTo(root.firstElementChild!);
    expect(tip().textContent).toBe('tip');
    expect(registry.size).toBe(0);
  });
});
