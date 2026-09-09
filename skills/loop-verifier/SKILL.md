---
name: loop-verifier
description: Independent verification of a maker's output using a fresh-context subagent. Default stance is REJECT. Use after every compound-slicer slice or any other auto-merge candidate to enforce the maker/checker split. Returns a strict JSON verdict.
---

# loop-verifier

Compounds into a `subagent` (not `subagent_fork` — that would share parent context and violate anti-pattern #1). The verifier must:

1. Receive only the diff (file paths + contents) and the task description
2. NOT receive the maker's reasoning, prior turns, or git history
3. Run `pnpm test` from `Browserapp/` and `pnpm test:coverage`
4. Inspect the diff for: denylist touches, console.log residue, missing test coverage of new branches
5. Default verdict is `REJECT`; explicit evidence required for `PASS`

## When to invoke

- After every `compound-slicer` slice is implemented
- Before any `[auto-merge-eligible]` PR is queued by `loop-pr-babysitter`
- After `loop-ci-sweeper` produces a fix

## Input contract

- `task_id`: from STATE.md High Priority
- `diff`: list of `{ path, content }` pairs (no reasoning, no chat)
- `test_commands`: list of shell commands to verify (default: `pnpm test`, `pnpm test:coverage`)

## Output contract

See `output-schema.json`. `verdict` must be one of:
- `PASS`: all tests green, no denylist touch, evidence supports the change
- `FAIL`: one or more tests failed or denylist touched
- `ESCALATE`: ambiguous; needs human review (e.g. coverage delta unclear)

`score` is 0-100. `min_score_to_pass` is 70 (per `compound-verifier` pattern).

## Anti-patterns to avoid

- Do not share the maker's conversation history with the verifier.
- Do not let the verifier "look at the commit message" — only diff + tests.
- Do not allow `PASS` without `evidence.tests_run > 0` and `evidence.tests_passed === evidence.tests_run`.
- Do not let the same subagent role run twice; spawn fresh each time.
