import { resolve } from 'node:path';

import { CHECKS } from './verify/checks.ts';
import { execute } from './verify/execute.ts';
import { gapsFor, probeRequirement, uncommittedWork } from './verify/honesty.ts';
import type { Check } from './verify/ports.ts';
import { runVerify } from './verify/run.ts';

const ROOT = resolve(import.meta.dirname, '..');

const install: Check = { name: 'npm ci', group: 'install', requirements: ['network'], command: ['npm', 'ci'] };

process.exitCode = runVerify({
  prepare: install,
  checks: CHECKS,
  groups: process.argv.slice(2),
  execute: (check) => execute(check, ROOT),
  write: (text) => process.stdout.write(text),
  probe: probeRequirement,
  gaps: gapsFor(process.env),
  uncommitted: uncommittedWork(ROOT),
});
