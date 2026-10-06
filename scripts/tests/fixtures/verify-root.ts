import { availableParallelism } from 'node:os';

import { execute } from '../../verify/execute.ts';
import { gapsFor, probeRequirement, uncommittedWork } from '../../verify/honesty.ts';
import type { Check } from '../../verify/ports.ts';
import { interruptible, modeOf, runVerify } from '../../verify/run.ts';

const node = (code: string): readonly string[] => ['node', '-e', code];

const broken = new Set((process.env['FIXTURE_BROKEN'] ?? '').split(',').filter((name) => name !== ''));

const fixture = (name: string, group: string): Check => ({
  name,
  group,
  requirements: [],
  command: node(broken.has(name) ? 'console.log("boom"); process.exit(1)' : 'process.exit(0)'),
});

const needsClaude: readonly Check[] =
  process.env['FIXTURE_CLAUDE'] === '1'
    ? [{ name: 'needs claude', group: 'gamma', requirements: ['claude'], command: node('process.exit(0)') }]
    : [];

const trapped: readonly Check[] =
  process.env['FIXTURE_TRAP'] === '1'
    ? [
        {
          name: 'trapped',
          group: 'delta',
          requirements: [],
          command: ['bash', '-c', 'trap "echo trapped > trapped; exit 143" TERM HUP; echo ready > ready; sleep 30 & wait'],
        },
      ]
    : [];

const checks: readonly Check[] = [fixture('one', 'alpha'), fixture('two', 'alpha'), fixture('three', 'beta'), ...needsClaude, ...trapped];

const prepare: Check = {
  name: 'install',
  group: 'install',
  requirements: [],
  command: node('require("fs").mkdirSync("node_modules",{recursive:true});require("fs").writeFileSync("node_modules/.installed","")'),
};

const abort = interruptible();
const { groups, concurrency } = modeOf(process.argv.slice(2), availableParallelism());

process.exitCode = await runVerify({
  prepare,
  checks,
  groups,
  concurrency,
  abort,
  execute: (check, signal) => execute(check, process.cwd(), signal),
  write: (text) => process.stdout.write(text),
  probe: probeRequirement,
  gaps: process.env['FIXTURE_HONEST'] === '1' ? gapsFor(process.env, process.env['FIXTURE_NODE']) : [],
  uncommitted: uncommittedWork(process.cwd()),
});
