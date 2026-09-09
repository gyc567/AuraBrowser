// DSH adapter: bridges loop-cli to the DeepSeek Harness runtime.
// Week 1: stub. Reads DSH environment, exposes DSH tool names for operator counting.
// Week 2: implement actual `cordis_*` bridge via the available cordis_inspect_list API.

import { existsSync } from 'node:fs';

const DSH_TOOLS_COUNTED = new Set([
  'write',
  'edit',
  'bash',
  'subagent',
  'subagent_fork',
  'web_search',
  'web_fetch',
  'cordis_define',
  'cordis_run',
  'cordis_stop',
]);

const DSH_TOOLS_NOT_COUNTED = new Set([
  'read',
  'glob',
  'grep',
  'list_agents',
  'job_list',
  'job_kill',
  'job_output',
  'todo_write',
  'ask_user_question',
  'skill',
  'cordis_inspect_list',
  'cordis_inspect_query',
  'cordis_inspect_self',
]);

export function isCounted(tool) {
  if (DSH_TOOLS_COUNTED.has(tool)) return true;
  if (DSH_TOOLS_NOT_COUNTED.has(tool)) return false;
  return true; // unknown = count for safety
}

export function dshAvailable() {
  // Week 1: any process.env.DSH_* present
  return Object.keys(process.env).some((k) => k.startsWith('DSH_')) || existsSync('.dsh');
}

export function adapterInfo() {
  return {
    name: 'dsh',
    week: 1,
    status: 'stub',
    counted: [...DSH_TOOLS_COUNTED],
    not_counted: [...DSH_TOOLS_NOT_COUNTED],
  };
}
