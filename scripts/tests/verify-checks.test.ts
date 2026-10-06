import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { CEILING_SECONDS, CHECKS } from '../verify/checks.ts';
import { GROUPS, OPT_IN } from '../verify/groups.ts';
import { selectChecks } from '../verify/run.ts';
import { catalogParity, catalogSources, catalogValid, pluginManifests } from '../verify/manifests.ts';

const SCRIPTS = resolve(import.meta.dirname, '..');

const commandOf = (check: (typeof CHECKS)[number]): string => ('command' in check ? check.command.join(' ') : '');

const expectedOutput = (fragment: string): RegExp => {
  const found = CHECKS.find((check) => commandOf(check).includes(fragment));

  assert.ok(found !== undefined && 'expectOutput' in found && found.expectOutput !== undefined, fragment);

  return found.expectOutput;
};

const repository = (
  catalog: unknown,
  manifests: Record<string, unknown>,
): string => {
  const root = mkdtempSync(join(tmpdir(), 'verify-manifests-'));
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify(catalog));

  for (const [name, manifest] of Object.entries(manifests)) {
    mkdirSync(join(root, 'plugins', name, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(root, 'plugins', name, '.claude-plugin', 'plugin.json'),
      typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
    );
  }

  return root;
};

const entry = { name: 'alpha', version: '1.0.0', description: 'd', source: './plugins/alpha' };

test('every check belongs to a known group and every group has a check', () => {
  for (const group of GROUPS) {
    assert.ok(CHECKS.some((check) => check.group === group), group);
  }

  for (const check of CHECKS) {
    assert.ok(GROUPS.includes(check.group), check.name);
  }
});

test('check names are unique', () => {
  assert.equal(new Set(CHECKS.map((check) => check.name)).size, CHECKS.length);
});

test('no argument selects every check but the opt-in canary, which runs only when named', () => {
  const bare = selectChecks(CHECKS, []);

  assert.deepEqual([...OPT_IN], ['canary']);
  assert.deepEqual(bare, CHECKS.filter((check) => check.group !== 'canary'));

  const canary = selectChecks(CHECKS, ['canary']);

  assert.ok(canary.length > 0);
  assert.ok(canary.every((check) => check.group === 'canary'));
  assert.throws(() => selectChecks(CHECKS, ['nonsense']), /nonsense/);
});

test('only the goal suite and the mutation check run alone', () => {
  assert.deepEqual(
    CHECKS.filter((check) => check.exclusive === true).map((check) => check.group),
    ['goal-gate', 'mutation'],
  );
});

test('jq is no longer a requirement of any check', () => {
  for (const check of CHECKS) {
    assert.ok(!commandOf(check).includes('jq'), check.name);
    assert.ok(!(check.requirements as readonly string[]).includes('jq'), check.name);
  }
});

test('the ceiling is applied by the suite check and no other file under scripts/ passes --wall a number', () => {
  const budget = CHECKS.find((check) => commandOf(check).includes('budget.ts'));
  assert.ok(budget !== undefined);
  assert.ok(commandOf(budget).includes(`--wall ${CEILING_SECONDS}`));

  const files = readdirSync(SCRIPTS, { recursive: true, encoding: 'utf8' })
    .filter((path) => /\.(ts|sh)$/.test(path) && statSync(join(SCRIPTS, path)).isFile());

  for (const file of files) {
    if (file === join('verify', 'checks.ts')) {
      continue;
    }

    assert.doesNotMatch(readFileSync(join(SCRIPTS, file), 'utf8'), /--wall['",\s]+\d/, file);
  }
});

test('no check runs through npm or npx, which a committed npm setting could turn into a no-op', () => {
  for (const check of CHECKS) {
    const [program = ''] = 'command' in check ? check.command : [];

    assert.ok(!['npm', 'npx'].includes(program), check.name);
  }
});

test('on macOS every shell suite runs under /bin/bash 3.2, as the hooks and the macOS CI leg do', { skip: process.platform === 'darwin' ? false : 'macOS only' }, () => {
  for (const check of CHECKS.filter((candidate) => candidate.group === 'shell-suites')) {
    const [bash = ''] = 'command' in check ? check.command : [];

    assert.match(spawnSync(bash, ['-c', 'printf %s "$BASH_VERSION"'], { encoding: 'utf8' }).stdout, /^3\.2\./, check.name);
  }
});

test('no check installs globally or touches marketplaces', () => {
  for (const check of CHECKS) {
    assert.doesNotMatch(commandOf(check), /install -g|--global|marketplace (add|update|remove)|plugin install/, check.name);
  }
});

test('the plugin validation is strict, for the marketplace and for each plugin', () => {
  const validations = CHECKS.filter((check) => check.group === 'plugin-validate');

  assert.equal(validations.length, 2);

  for (const check of validations) {
    assert.match(commandOf(check), /claude plugin validate --strict /, check.name);
  }
});

test('the canary runs the same strict validations as plugin-validate, with the claude it installed', () => {
  const commands = (group: string): readonly string[] => CHECKS.filter((check) => check.group === group).map(commandOf);
  const canary = CHECKS.filter((check) => check.group === 'canary' && commandOf(check).includes('claude plugin validate'));

  assert.deepEqual(canary.map(commandOf), commands('plugin-validate'));

  for (const check of canary) {
    assert.deepEqual(check.requirements, ['claude'], check.name);
  }
});

test('the repository meta-checks run in structure, so the shell-suites matrix runs only the hook and script suites', () => {
  for (const suite of ['scripts/tests/test-skill-coherence.sh', 'scripts/tests/test-validate-anchors.sh']) {
    const found = CHECKS.filter((check) => commandOf(check).includes(suite));

    assert.equal(found.length, 1, suite);
    assert.equal(found[0]?.group, 'structure', suite);
    assert.equal(found[0] !== undefined && 'expectOutput' in found[0] ? String(found[0].expectOutput) : '', String(/^Total: [1-9]\d* pass, 0 fail$/m), suite);
  }

  for (const check of CHECKS.filter((candidate) => candidate.group === 'shell-suites')) {
    assert.match(commandOf(check), / plugins\/[a-z-]+\/tests\/test[-_][a-z-]+\.sh$/, check.name);
  }
});

test('the unit group runs the scripts, skills and node-test example tests in one command', () => {
  const [unit, ...others] = CHECKS.filter((check) => check.group === 'unit');

  assert.ok(unit !== undefined);
  assert.deepEqual(others, []);
  assert.ok(commandOf(unit).includes('scripts/tests/*.test.ts plugins/skills/tests/*.test.ts'));
  assert.ok(commandOf(unit).includes('--experimental-test-module-mocks'));
});

test('a shell suite passes only on a run of at least one case and no failure', () => {
  const total = expectedOutput('test-hooks.sh');

  assert.ok(total.test('  PASS  one\nTotal: 12 pass, 0 fail\n'));
  assert.ok(!total.test('Total: 0 pass, 0 fail\n'));
  assert.ok(!total.test('Total: 12 pass, 1 fail\n'));
});

test('the tree certification passes only with no blocking failure', () => {
  const certified = expectedOutput('certify.ts --all');

  assert.ok(certified.test('Certified 112 skill(s), 6 agent(s), 5 evals file(s): 0 blocking failure(s), 1 advisory finding(s)'));
  assert.ok(!certified.test('Certified 112 skill(s), 6 agent(s), 5 evals file(s): 2 blocking failure(s), 1 advisory finding(s)'));
  assert.ok(!certified.test('Certified 0 skill(s), 0 agent(s), 0 evals file(s): 0 blocking failure(s), 0 advisory finding(s)'));
});

test('the doc anchors and module headers refuse a run that checked nothing', () => {
  assert.ok(expectedOutput('validate-anchors.sh').test('275 anchors checked: 9 carry a verified symbol, 266 checked on file existence only'));
  assert.ok(!expectedOutput('validate-anchors.sh').test('0 anchors checked: 0 carry a verified symbol, 0 checked on file existence only'));
  assert.ok(expectedOutput('no-module-headers.sh').test('✓ 50 module(s) checked, none open on an undeclared header'));
  assert.ok(!expectedOutput('no-module-headers.sh').test('✓ 0 module(s) checked, none open on an undeclared header'));
});

test('a valid catalog and manifests raise no finding', () => {
  const root = repository({ plugins: [entry] }, { alpha: { name: 'alpha', version: '1.0.0', description: 'd' } });
  try {
    assert.deepEqual(catalogValid(root), []);
    assert.deepEqual(pluginManifests(root), []);
    assert.deepEqual(catalogParity(root), []);
    assert.deepEqual(catalogSources(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an invalid or missing manifest is named', () => {
  const root = repository({ plugins: [entry] }, { alpha: '{ nope' });
  mkdirSync(join(root, 'plugins', 'beta'), { recursive: true });
  try {
    const findings = pluginManifests(root).join('\n');
    assert.match(findings, /Invalid JSON.*alpha/);
    assert.match(findings, /Missing.*beta/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an invalid catalog is named', () => {
  const root = repository('{ nope', {});
  try {
    assert.equal(catalogValid(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a version disagreement between catalog and manifest is named', () => {
  const root = repository({ plugins: [entry] }, { alpha: { name: 'alpha', version: '2.0.0', description: 'd' } });
  try {
    const findings = catalogParity(root);
    assert.equal(findings.length, 1);
    assert.match(findings[0] ?? '', /alpha.*version/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a local source that does not exist is named, a remote one is ignored', () => {
  const root = repository(
    { plugins: [{ ...entry, source: './plugins/ghost' }, { name: 'r', source: { source: 'github' } }] },
    {},
  );
  try {
    const findings = catalogSources(root);
    assert.equal(findings.length, 1);
    assert.match(findings[0] ?? '', /ghost/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
