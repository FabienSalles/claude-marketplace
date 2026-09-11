import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { aggregateLevel, aggregateVerdict, type Finding, type Verdict } from './verdict.ts';

const SOURCE = 'skills:plugin-conventions';
const REQUIRED_FIELDS = ['name', 'version', 'description'];

// I2 — a plugin with no skills directory has nothing an agentskills-level certifier can check,
// so it certifies on its own structure instead: a readable, valid .claude-plugin/plugin.json
// with the required fields. Missing or malformed manifests still fail rather than being skipped.
export const certifyPluginStructure = (pluginDir: string): Verdict => {
  const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json');

  if (!existsSync(manifestPath)) {
    const missing: Finding = {
      rule: 'plugin-manifest-readable',
      status: 'fail',
      detail: `missing ${manifestPath}`,
      source: SOURCE,
    };

    return aggregateVerdict(pluginDir, [aggregateLevel(2, true, [missing])]);
  }

  let manifest: Record<string, unknown>;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    const malformed: Finding = {
      rule: 'plugin-manifest-readable',
      status: 'fail',
      detail: `${manifestPath} is not valid JSON: ${(error as Error).message}`,
      source: SOURCE,
    };

    return aggregateVerdict(pluginDir, [aggregateLevel(2, true, [malformed])]);
  }

  const fieldNames = Object.keys(manifest);
  const missing = REQUIRED_FIELDS.filter((name) => !fieldNames.includes(name));

  const requiredFields: Finding = {
    rule: 'plugin-manifest-required-fields',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail:
      missing.length === 0
        ? `${REQUIRED_FIELDS.join(', ')} present`
        : `${manifestPath} is missing required field(s): ${missing.join(', ')}`,
    source: SOURCE,
  };

  return aggregateVerdict(pluginDir, [aggregateLevel(2, true, [requiredFields])]);
};
