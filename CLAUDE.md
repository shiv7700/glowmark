@AGENTS.md

## Claude Code specifics

- After changing `src/`, run the `glowmark-reviewer` subagent (`.claude/agents/glowmark-reviewer.md`). It checks the change against the rules in AGENTS.md.
- Before saying a change is done, run `npm run typecheck && npm test`.
- Tooltip positioning only matters in a real browser. For layout changes, check `examples/index.html` with Playwright.
