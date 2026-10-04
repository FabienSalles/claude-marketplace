import { runVerify } from '../../verify/run.ts';
import { execute } from '../../verify/execute.ts';
import type { Check } from '../../verify/ports.ts';

const node = (code: string): readonly string[] => ['node', '-e', code];

const broken = new Set((process.env['FIXTURE_BROKEN'] ?? '').split(',').filter((name) => name !== ''));

const fixture = (name: string, group: string): Check => ({
  name,
  group,
  requirements: [],
  command: node(broken.has(name) ? 'console.log("boom"); process.exit(1)' : 'process.exit(0)'),
});

const checks: readonly Check[] = [fixture('one', 'alpha'), fixture('two', 'alpha'), fixture('three', 'beta')];

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
});
