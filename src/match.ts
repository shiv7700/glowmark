export interface Match {
  /** The full matched text, e.g. `{{name}}`. */
  text: string;
  /** The pattern's capture groups, e.g. `['name']`. Missing groups are `''`. */
  groups: string[];
}

export interface Rule {
  /** Identifies the rule. Style its matches with `::highlight(glowmark-<name>)`, so it must be a valid CSS identifier. */
  name: string;
  /** What to highlight. The `g` flag is added if missing. */
  pattern: RegExp;
  /** Tooltip text for a match, read on hover. Omit it, or return `''`, for no tooltip. */
  tooltip?: (match: Match) => string;
}

export interface Found {
  start: number;
  end: number;
  rule: Rule;
  groups: string[];
}

/** A fresh global copy: matchAll would start at a reused regex's `lastIndex`, and `y` would stop at the first gap. */
export function asGlobal(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '') + 'g');
}

/**
 * Returns the non-overlapping matches in `text`, in order. Patterns must be global.
 * The earliest match wins; on a tie, the rule listed first wins.
 */
export function findMatches(text: string, rules: Rule[]): Found[] {
  const candidates = rules.flatMap((rule, order) =>
    [...text.matchAll(rule.pattern)]
      .filter((m) => m[0] !== '')
      .map((m) => ({
        start: m.index!,
        end: m.index! + m[0].length,
        rule,
        order,
        groups: m.slice(1).map((g) => g ?? ''),
      })),
  );
  candidates.sort((a, b) => a.start - b.start || a.order - b.order);

  const found: Found[] = [];
  let lastEnd = 0;
  for (const { start, end, rule, groups } of candidates) {
    if (start < lastEnd) continue;
    found.push({ start, end, rule, groups });
    lastEnd = end;
  }
  return found;
}
