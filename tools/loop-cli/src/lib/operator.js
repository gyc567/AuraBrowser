// Per-run operator log and counter.
// Writes one JSONL line per tool call to docs/loop-engineering/state/operators-{runId}.jsonl.

import { appendFile, writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OPERATORS_DIR = 'docs/loop-engineering/state';

const COUNTED = new Set([
  'write',
  'edit',
  'bash',
  'subagent',
  'subagent_fork',
  'job_output',
  'web_search',
  'web_fetch',
  'cordis_define',
  'cordis_run',
  'cordis_stop',
]);
const NOT_COUNTED = new Set([
  'read',
  'glob',
  'grep',
  'list_agents',
  'job_list',
  'job_kill',
  'todo_write',
  'ask_user_question',
  'skill',
  'cordis_inspect_list',
  'cordis_inspect_query',
  'cordis_inspect_self',
]);

export function isCountedOperator(toolName) {
  if (COUNTED.has(toolName)) return true;
  if (NOT_COUNTED.has(toolName)) return false;
  return true; // default: count unknown tools to be safe
}

function hashArgs(args) {
  const json = JSON.stringify(args || {}, Object.keys(args || {}).sort());
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

export function operatorLogPath(runId) {
  return path.join(OPERATORS_DIR, `operators-${runId}.jsonl`);
}

export async function recordOperator(runId, entry) {
  if (!existsSync(OPERATORS_DIR)) {
    await mkdir(OPERATORS_DIR, { recursive: true });
  }
  const line =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      tool: entry.tool,
      args_hash: hashArgs(entry.args),
      time_ms: entry.time_ms ?? 0,
      counted: isCountedOperator(entry.tool),
    }) + '\n';
  await appendFile(operatorLogPath(runId), line, 'utf8');
}

export async function countOperators(runId) {
  const p = operatorLogPath(runId);
  if (!existsSync(p)) return 0;
  const text = await readFile(p, 'utf8');
  let count = 0;
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.counted) count += 1;
    } catch {
      // skip malformed
    }
  }
  return count;
}

export async function structureHash(runId) {
  const p = operatorLogPath(runId);
  if (!existsSync(p)) return null;
  const text = await readFile(p, 'utf8');
  return createHash('sha256').update(text).digest('hex');
}
