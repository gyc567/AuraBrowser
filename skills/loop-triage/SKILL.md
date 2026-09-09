---
name: loop-triage
description: Scan the AuraBrowser repo for next work and propose prioritized items to STATE.md. Use when a daily, weekly, or on-demand check is needed to populate the High Priority queue. Output is a strict JSON object (see output-schema.json) that loop-state-update writes to state/current.json.
---

# loop-triage

Discovers work by inspecting:
- `git log` since last triage
- `STATE.md` current High Priority and Watch sections
- `pnpm lint`, `pnpm test`, `pnpm test:coverage` results
- `*.selftest.js` count vs `tests/**/*.test.js` count
- `eslint.config.js` strict/lenient coverage

Produces a JSON object per `output-schema.json`. Pass to `loop-state-update` to merge into `state/current.json`.

## When to invoke

- Daily cron (weekdays 09:00 UTC) via `loop-daily-triage` workflow
- After any merge to `main` (post-merge-cleanup piggyback)
- Manually when STATE.md High Priority is empty and the team needs next work

## Input contract

- `pattern_id`: which pattern triggered this (e.g. `daily-triage`, `post-merge-cleanup`)
- `since`: ISO 8601 timestamp (default: last triage run)
- `scope`: subset of paths to inspect (default: whole repo)

## Output contract

See `output-schema.json`. Always include `timestamp` and `summary`. `high_priority` items must follow the item schema (id, title, score, category). Keep `summary` ≤ 500 chars.

## Anti-patterns to avoid

- Do not output free-form narrative paragraphs; always return the JSON shape.
- Do not include code suggestions; only identify and score.
- Do not modify STATE.md directly; return JSON for `loop-state-update`.
- Do not invent items that are not traceable to a concrete git log entry, test gap, or lint warning.

## Example output

```json
{
  "timestamp": "2026-09-09T09:00:00Z",
  "summary": "Phase 2 engine refactor still uncut; 70+ selftests unmigrated; coverage holding at 93.89%.",
  "high_priority": [
    {
      "id": "REFAC-engine-slicer",
      "title": "Run compound-slicer to decompose engine.js into 6-8 slice-cards",
      "score": 92,
      "category": "refactor"
    }
  ],
  "watch": ["coverage stable", "70+ selftests unmigrated"],
  "escalations": []
}
```
