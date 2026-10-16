import { describe, expect, it } from 'vitest';
import { asGlobal, findMatches } from '../src/match.js';
import { words } from '../src/index.js';

const found = (text: string, rule: ReturnType<typeof words>) =>
  findMatches(text, [{ ...rule, pattern: asGlobal(rule.pattern) }]).map((f) => text.slice(f.start, f.end));

describe('words', () => {
  it('ignores case by default', () => {
    expect(found('React and REACT and react', words(['react']))).toEqual(['React', 'REACT', 'react']);
  });

  it('can match case exactly', () => {
    expect(found('React and react', words(['react'], { caseSensitive: true }))).toEqual(['react']);
  });

  it('treats special characters as plain text', () => {
    expect(found('Price: $5.00 (approx) or 5x00', words(['$5.00', '(approx)']))).toEqual(['$5.00', '(approx)']);
  });

  it('prefers the longer term', () => {
    expect(found('react hooks', words(['react', 'react hooks']))).toEqual(['react hooks']);
  });

  it('trims, dedupes and ignores blank terms', () => {
    expect(found('a b', words([' a ', 'a', '', '   ']))).toEqual(['a']);
  });

  it('matches nothing for an empty search', () => {
    expect(found('anything', words([]))).toEqual([]);
    expect(found('anything', words(['  ']))).toEqual([]);
  });

  it('uses the "search" rule name unless overridden, and keeps other options', () => {
    const tooltip = () => 'hit';
    expect(words(['x'])).toMatchObject({ name: 'search' });
    expect(words(['x'], { name: 'find', tooltip })).toMatchObject({ name: 'find', tooltip });
  });
});
