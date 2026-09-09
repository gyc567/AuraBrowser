---
name: loop-minimal-fix
description: Apply a strictly-scoped minimal fix to a single file or a small adjacent pair. Use when a loop decides a small auto-fix is safe (e.g. format churn, typo, dead import, missing test stub). Output reports files changed and verification result.
---

# loop-minimal-fix

The minimal possible diff that resolves a single concrete issue. Hard constraints:

- ≤ 3 files
- ≤ 50 lines net diff
- No changes to any denylist path (see `config/loop/gate.yaml`)
- All denylist references in tests trigger `compound_rule test_changes_denied` and escalate

## When to invoke

- After `loop-triage` flags a small fixable item
- After `loop-pr-babysitter` sees a review comment that is purely cosmetic or trivial
- After `loop-ci-sweeper` classifies a CI failure as `trivial-fix` (e.g. format-only, import-only)

## Input contract

- `task_id`: from STATE.md High Priority
- `scope`: one of `format-only | import-only | typo | test-stub | other`
- `target_files`: list of paths

## Output contract

See `output-schema.json`. Always include `files_changed`, `lines_added`, `lines_removed`, `test_passed`, `verdict`. Default verdict is `OK`; set to `ESCALATE` if scope is exceeded or denylist hit.

## Anti-patterns to avoid

- Do not refactor; fix only the named issue.
- Do not change unrelated lines (no drive-by edits).
- Do not skip running tests.
- Do not invent new error codes or change error wording.

## Example

```json
{
  "task_id": "FMT-tab-spacing",
  "files_changed": ["Browserapp/automation/ip-health-score.js"],
  "lines_added": 0,
  "lines_removed": 2,
  "test_passed": true,
  "verdict": "OK",
  "operator_count": 6,
  "time_seconds": 28
}
```
