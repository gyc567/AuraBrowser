#!/usr/bin/env node
// @aura/loop CLI entry
// Usage: loop <command> [args] [flags]
//   loop init . [--pattern X] [--tool Y] [--force]
//   loop doctor .
//   loop status . [--json]
//   loop audit . [--json]
//   loop reconcile . [--json] [--adopt | --purge]
//   loop cost --pattern X [--proposed-operators N] [--proposed-time-seconds T] [--json]
//   loop slicer --goal X [--dry-run] [--json]

import { runInit } from '../src/init.js';
import { runDoctor } from '../src/doctor.js';
import { runStatus } from '../src/status.js';
import { runAudit } from '../src/audit.js';
import { runReconcile } from '../src/reconcile.js';
import { runCost } from '../src/cost.js';
import { runSlicer } from '../src/slicer.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[a.slice(2)] = next;
          i += 1;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv);
  const [cmd, cwdArg = '.'] = positional;

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`@aura/loop CLI (v0.1.0)

Usage:
  loop init . [--pattern X] [--tool Y] [--force]
  loop doctor .
  loop status . [--json]
  loop audit . [--json]
  loop reconcile . [--json] [--adopt | --purge]
  loop cost --pattern X [--proposed-operators N] [--proposed-time-seconds T] [--json]

Run \`loop doctor .\` first to check the framework is in place.
`);
    return;
  }

  let result;
  try {
    switch (cmd) {
      case 'init':
        result = await runInit({
          cwd: cwdArg,
          pattern: flags.pattern || 'daily-triage',
          tool: flags.tool || 'dsh',
          force: !!flags.force,
        });
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'doctor':
        result = await runDoctor({ cwd: cwdArg });
        for (const c of result.checks) {
          const mark = c.pass ? '✓' : '✗';
          const detail = c.detail ? `  (${c.detail})` : '';
          console.log(`  ${mark} ${c.name}${detail}`);
        }
        console.log(
          `\n${result.passed}/${result.passed + result.failed} passed. ${result.ok ? 'OK' : 'FAILED'}`
        );
        if (!result.ok) process.exit(1);
        break;
      case 'status':
        if (flags.json) {
          result = await runStatus({ cwd: cwdArg, json: true });
          console.log(JSON.stringify(result, null, 2));
        } else {
          result = await runStatus({ cwd: cwdArg });
          console.log(result);
        }
        break;
      case 'audit':
        if (flags.json) {
          result = await runAudit({ cwd: cwdArg, json: true });
          console.log(JSON.stringify(result, null, 2));
        } else {
          result = await runAudit({ cwd: cwdArg });
          console.log(result);
        }
        break;
      case 'reconcile':
        if (flags.json) {
          result = await runReconcile({
            cwd: cwdArg,
            json: true,
            adopt: !!flags.adopt,
            purge: !!flags.purge,
          });
          console.log(JSON.stringify(result, null, 2));
        } else {
          result = await runReconcile({
            cwd: cwdArg,
            adopt: !!flags.adopt,
            purge: !!flags.purge,
          });
          console.log(result);
        }
        break;
      case 'cost': {
        const pattern = flags.pattern;
        if (!pattern) {
          console.error('--pattern is required for cost');
          process.exit(2);
        }
        const opts = {
          pattern,
          proposedOperators: parseInt(flags['proposed-operators'] || '10', 10),
          proposedTimeSeconds: parseInt(flags['proposed-time-seconds'] || '120', 10),
        };
        if (flags.json) {
          result = await runCost({ ...opts, json: true });
          console.log(JSON.stringify(result, null, 2));
        } else {
          result = await runCost(opts);
          console.log(result);
        }
        break;
      }
      case 'slicer': {
        const opts = {
          goal: flags.goal || 'REFAC-engine-modularize',
          dryRun: !!flags['dry-run'],
          json: !!flags.json,
        };
        result = await runSlicer(opts);
        if (flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Slicer: ${result.task_id}`);
          console.log(`Slices: ${result.slices.length}`);
          for (const s of result.slices) {
            console.log(`  - [${s.gate}] ${s.id}: ${s.slice}`);
            console.log(`      files: ${s.files.length}, depends: [${s.depends_on.join(', ') || 'none'}]`);
          }
          console.log(`\nSummary: ${result.summary}`);
        }
        break;
      }
      default:
        console.error(`unknown command: ${cmd}\nrun \`loop --help\``);
        process.exit(2);
    }
  } catch (err) {
    console.error(`error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
