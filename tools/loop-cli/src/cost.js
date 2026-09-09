// loop cost --pattern <id> --proposed-operators N --proposed-time-seconds T
// Stub: compares proposed to per-pattern cap and returns cap_status.

import { readYamlFile } from './lib/yaml.js';

export async function runCost({
  pattern = 'daily-triage',
  proposedOperators = 10,
  proposedTimeSeconds = 120,
  json = false,
} = {}) {
  const reg = await readYamlFile('config/loop/registry.yaml');
  const comp = await readYamlFile('config/loop/compound.yaml');
  const all = [...(reg.patterns || []), ...(comp.patterns || [])];
  const pat = all.find((p) => p.id === pattern);
  if (!pat) {
    return { error: `pattern not found: ${pattern}` };
  }
  const capOps = pat.cost.operators_action || pat.cost.operators_report || 30;
  const capTime = pat.cost.time_cap_seconds || 600;
  const opRatio = proposedOperators / capOps;
  const timeRatio = proposedTimeSeconds / capTime;
  const maxRatio = Math.max(opRatio, timeRatio);
  const capStatus = maxRatio >= 2 ? 'kill' : maxRatio >= 1 ? 'over' : maxRatio >= 0.5 ? 'near' : 'under';
  const estTokens = proposedOperators * 5000 + proposedTimeSeconds * 800;
  const result = {
    pattern_id: pattern,
    proposed: { operators: proposedOperators, time_seconds: proposedTimeSeconds },
    cap: { operators: capOps, time_seconds: capTime },
    ratio: { operators: opRatio, time_seconds: timeRatio },
    cap_status: capStatus,
    estimated_tokens: estTokens,
  };
  if (json) return result;
  const lines = [];
  lines.push(`Cost estimate for ${pattern}`);
  lines.push(`==========================`);
  lines.push(`Proposed: ${proposedOperators} ops / ${proposedTimeSeconds}s`);
  lines.push(`Cap:      ${capOps} ops / ${capTime}s`);
  lines.push(`Ratio:    ops=${opRatio.toFixed(2)}  time=${timeRatio.toFixed(2)}`);
  lines.push(`Status:   ${capStatus}`);
  lines.push(`Est tokens: ${estTokens}`);
  return lines.join('\n');
}
