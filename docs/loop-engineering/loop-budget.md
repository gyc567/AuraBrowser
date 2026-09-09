# Loop Budget (双轨：算子 + 时间)

> AuraBrowser loop operations are gated by both **operator count** (per DSH tool call)
> and **wall-clock time** (per pattern run). Either hitting the cap triggers block.

## Per-Pattern Caps

| pattern | operators/run | time/run | fail_action |
|---------|---------------|----------|-------------|
| daily-triage | 30 | 300 s | block + alert |
| thin-loop | 3 | 120 s | block + alert |
| pr-babysitter | 80 | 900 s | block + alert |
| ci-sweeper | 50 | 600 s | block + alert |
| post-merge-cleanup | 20 | 300 s | block + alert |
| dependency-sweeper | 60 | 600 s | block + alert |
| changelog-drafter | 25 | 300 s | block + alert |
| issue-triage | 25 | 300 s | block + alert |
| compound-slicer | 40 | 600 s | block |
| compound-verifier | 15 | 300 s | block |

## Daily Caps

- total_operators: 200 / day
- total_time: 3600 s (60 min) / day
- hard_kill: any single run > 2× its cap → kill + alert
- daily_reset: 00:00 UTC

## Per-Item Caps

- max_attempts_same_item: 3
- max_PRs_per_day:
  - pr-babysitter: 4
  - post-merge-cleanup: 2
  - compound-slicer: 3
  - changelog-drafter: 1
  - ci-sweeper: 2
- max_slices_per_goal: 12
- max_concurrent_runs: 1

## Operator Count Definition

A "operator" is one DSH tool invocation that performs a side effect or substantive read:
- **Counted**: write, edit, bash (non-zero exit), subagent (non-fork), job_output (read)
- **Not counted**: read, glob, grep, list_agents, job_list, todo_write, ask_user_question
- Each subagent recursion adds 1 + the subagent's operators

Per-run operator log: `docs/loop-engineering/state/operators-{runId}.jsonl`

## Kill Switch (TRIGGER = any of)

1. 连续 3 次 verifier FAIL on same PR
2. 同一 file 7 天内被改 ≥4 次
3. 主进程 denylist path 出现意外 diff (gate verdict = blocked)
4. operator 消耗 > 2× daily cap in 1 hour
5. total_time > daily cap
6. `state/current.json` schema validation fails on 2 consecutive runs

## Action on Trigger

1. stop the loop immediately
2. write `STATE.md` High Priority: `[BLOCKED: <reason>]`
3. write `loop-run-log.md` final entry: `KILLED: <reason>`
4. increment `paused_patterns` in `state/current.json`
5. require explicit `loop resume --pattern <id> --reason "..."` to continue

## Cost-to-Token Estimate (degraded)

DSH currently does not expose a token counter. We approximate:

- 1 operator ≈ 5000 tokens (input + output, single tool call)
- 1 second of DSH wall time ≈ 800 tokens (model reasoning)
- daily cap (200 op + 3600 s) ≈ 200 × 5000 + 3600 × 800 ≈ 3.88M tokens / day

Use `loop cost --pattern <id> --level <L1|L2|L3>` for per-run estimates.
