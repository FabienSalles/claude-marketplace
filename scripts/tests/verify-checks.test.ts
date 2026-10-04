import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { CEILING_SECONDS, CHECKS, GROUPS } from '../verify/checks.ts';
import { execute } from '../verify/execute.ts';
import type { Check } from '../verify/ports.ts';
import { selectChecks } from '../verify/run.ts';
import { catalogParity, catalogSources, catalogValid, pluginManifests } from '../verify/manifests.ts';

const SCRIPTS = resolve(import.meta.dirname, '..');

const commandOf = (check: (typeof CHECKS)[number]): string => ('command' in check ? check.command.join(' ') : '');

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

test('the groups mirror the pull-request jobs and every check belongs to one', () => {
  assert.deepEqual(
    [...GROUPS],
    ['structure', 'plugin-validate', 'skills-discovery', 'goal-gate', 'shell-suites', 'health-check'],
  );

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

test('no argument selects every check, named groups select only theirs', () => {
  assert.equal(selectChecks(CHECKS, []).length, CHECKS.length);
  const picked = selectChecks(CHECKS, ['skills-discovery']);
  assert.ok(picked.length > 0);
  assert.ok(picked.every((check) => check.group === 'skills-discovery'));
  assert.throws(() => selectChecks(CHECKS, ['nonsense']), /nonsense/);
});

test('jq is no longer a requirement of any check', () => {
  for (const check of CHECKS) {
    assert.ok(!commandOf(check).includes('jq'), check.name);
    assert.ok(!(check.requirements as readonly string[]).includes('jq'), check.name);
  }
});

test('the ceiling is applied by the suite check and named nowhere else under scripts/', () => {
  const budget = CHECKS.find((check) => commandOf(check).includes('budget.ts'));
  assert.ok(budget !== undefined);
  assert.ok(commandOf(budget).includes(`--wall ${CEILING_SECONDS}`));

  const literal = new RegExp(`\\b${CEILING_SECONDS}\\b`);
  const files = readdirSync(SCRIPTS, { recursive: true, encoding: 'utf8' })
    .filter((path) => /\.(ts|sh)$/.test(path) && statSync(join(SCRIPTS, path)).isFile());

  for (const file of files) {
    if (file === join('verify', 'checks.ts')) {
      continue;
    }

    assert.ok(!literal.test(readFileSync(join(SCRIPTS, file), 'utf8')), file);
  }
});

test('health-check runs --quick and nothing installs globally or touches marketplaces', () => {
  const health = CHECKS.find((check) => check.group === 'health-check');
  assert.ok(health !== undefined);
  assert.ok(commandOf(health).includes('--quick'));

  for (const check of CHECKS) {
    assert.doesNotMatch(commandOf(check), /install -g|--global|marketplace (add|update|remove)|plugin install/, check.name);
  }
});

test('the diff certification keeps its current form', () => {
  assert.ok(CHECKS.some((check) => commandOf(check).includes('certify.ts --diff origin/main')));
});

test("the structure group runs this command's own tests and fails when none ran", () => {
  const own = CHECKS.find((check) => commandOf(check).includes('scripts/tests/*.test.ts'));
  assert.ok(own !== undefined);
  assert.equal(own.group, 'structure');
  assert.ok('expectOutput' in own && own.expectOutput !== undefined);
  assert.ok(!own.expectOutput.test('ℹ tests 0\nℹ pass 0\n'));
  assert.ok(own.expectOutput.test('ℹ tests 12\nℹ pass 12\n'));
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

test('expected output is found through the colours a CI terminal adds', () => {
  const coloured: Check = {
    name: 'coloured',
    group: 'structure',
    requirements: [],
    command: ['printf', 'Found \\033[32m109\\033[39m skills\\n'],
    expectOutput: /Found \d+ skills/,
  };

  assert.equal(execute(coloured, tmpdir()).status, 'passed');
});
