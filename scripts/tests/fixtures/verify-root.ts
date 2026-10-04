import { runVerify } from '../../verify/run.ts';
import { execute } from '../../verify/execute.ts';
import { CHECKS } from '../../verify/checks.ts';
import { gapsFor, probeRequirement, uncommittedWork } from '../../verify/honesty.ts';
import type { Check } from '../../verify/ports.ts';

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

const discovery: readonly Check[] = CHECKS.filter((check) => check.group === 'skills-discovery' && process.env['FIXTURE_DISCOVERY'] === '1');

const checks: readonly Check[] = [fixture('one', 'alpha'), fixture('two', 'alpha'), fixture('three', 'beta'), ...needsClaude, ...discovery];

const prepare: Check = {
  name: 'install',
  group: 'install',
  requirements: [],
  command: node('require("fs").mkdirSync("node_modules",{recursive:true});require("fs").writeFileSync("node_modules/.installed","")'),
};

process.exitCode = runVerify({
  prepare,
  checks,
  groups: process.argv.slice(2),
  execute: (check) => execute(check, process.cwd()),
  write: (text) => process.stdout.write(text),
  probe: probeRequirement,
  gaps: process.env['FIXTURE_HONEST'] === '1' ? gapsFor(process.env) : [],
  uncommitted: uncommittedWork(process.cwd()),
});
