import type { Rule } from './match.js';

export type PresetOptions = Partial<Omit<Rule, 'pattern'>>;

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
