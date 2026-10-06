import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';

import { behindNotes } from './base.ts';
import { forCi } from './ci.ts';
import { CHECKS } from './checks.ts';
import { execute } from './execute.ts';
import { gapsFor, probeRequirement, uncommittedWork } from './honesty.ts';
import type { Check } from './ports.ts';
import { interruptible, modeOf, runVerify } from './run.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');

const install: Check = { name: 'npm ci', group: 'install', requirements: ['network'], command: ['npm', 'ci'] };

const abort = interruptible();
const { groups, concurrency } = modeOf(process.argv.slice(2), availableParallelism());

process.exitCode = await runVerify({
  prepare: install,
  checks: forCi(CHECKS, process.env),
  groups,
  concurrency,
  abort,
  execute: (check, signal) => execute(check, ROOT, signal),
  write: (text) => process.stdout.write(text),
  probe: probeRequirement,
  gaps: gapsFor(process.env),
  uncommitted: uncommittedWork(ROOT),
  notes: behindNotes(ROOT, process.env),
});
