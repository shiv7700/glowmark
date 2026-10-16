import type { Rule } from './match.js';

export type PresetOptions = Partial<Omit<Rule, 'pattern'>>;

export interface WordsOptions extends PresetOptions {
  /** Match letter case exactly. Default `false`. */
  caseSensitive?: boolean;
}

/** Matches `{{ name }}`. `groups[0]` is the trimmed name. */
export const mustache = (options: PresetOptions = {}): Rule => ({
  name: 'mustache',
  pattern: /\{\{\s*(.+?)\s*\}\}/g,
  ...options,
});

/** Matches `${ name }`. `groups[0]` is the trimmed name. */
export const template = (options: PresetOptions = {}): Rule => ({
  name: 'template',
  pattern: /\$\{\s*(.+?)\s*\}/g,
  ...options,
});

/**
 * Matches any of `list` as literal text, e.g. search terms. Special characters need no escaping.
 * Longer terms win over shorter ones they contain. Blank terms are ignored.
 */
export const words = (list: string[], { caseSensitive = false, ...options }: WordsOptions = {}): Rule => {
  const terms = [...new Set(list.map((term) => term.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  return {
    name: 'search',
    // (?!) never matches, so an empty search highlights nothing.
    pattern: new RegExp(terms.map(escapeRegExp).join('|') || '(?!)', caseSensitive ? 'g' : 'gi'),
    ...options,
  };
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
