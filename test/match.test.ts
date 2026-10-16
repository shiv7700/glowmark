import { describe, expect, it } from 'vitest';
import { asGlobal, findMatches } from '../src/match.js';
import { mustache, template } from '../src/index.js';

const texts = (text: string, rules: Parameters<typeof findMatches>[1]) =>
  findMatches(text, rules.map((r) => ({ ...r, pattern: asGlobal(r.pattern) }))).map((f) => [
    text.slice(f.start, f.end),
    f.rule.name,
    f.groups,
  ]);

describe('findMatches', () => {
  it('finds every match of several rules, in order', () => {
    expect(texts('{{ a }} and ${b} and {{c}}', [mustache(), template()])).toEqual([
      ['{{ a }}', 'mustache', ['a']],
      ['${b}', 'template', ['b']],
      ['{{c}}', 'mustache', ['c']],
    ]);
  });

  it('resolves overlaps: earliest match wins, then the rule listed first', () => {
    expect(texts('{{a}}', [{ name: 'word', pattern: /\w+/g }, mustache()])).toEqual([['{{a}}', 'mustache', ['a']]]);
    expect(texts('abc', [{ name: 'b', pattern: /abc/ }, { name: 'a', pattern: /abc/ }])).toEqual([['abc', 'b', []]]);
  });

  it('accepts a pattern without the g flag', () => {
    expect(texts('x x', [{ name: 'x', pattern: /x/ }])).toHaveLength(2);
  });

  it('finds every match with a sticky pattern', () => {
    expect(texts('Hi {{a}} and {{b}}', [{ name: 'm', pattern: /\{\{(\w+)\}\}/y }])).toHaveLength(2);
  });

  it('ignores the lastIndex left on a reused regex', () => {
    const pattern = /\{\{(\w+)\}\}/g;
    pattern.test('xx {{zzzz}}');
    expect(texts('Hi {{a}} and {{b}}', [{ name: 'm', pattern }])).toHaveLength(2);
  });

  it('ignores empty matches', () => {
    expect(texts('abc', [{ name: 'empty', pattern: /z*/g }])).toEqual([]);
  });

  it('turns unmatched optional groups into empty strings', () => {
    expect(texts('a', [{ name: 'opt', pattern: /a(b)?/g }])).toEqual([['a', 'opt', ['']]]);
  });
});
