import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { resolveArtifacts } from '../src/artifacts.ts';
import { tmpDir } from './support/tmp.ts';

const project = (): string => {
  const dir = tmpDir('artifact-project-');
  assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0);

  return realpathSync(dir);
};

test('resolution from a nested directory uses the Git root and exposes only artifact metadata', () => {
  const dir = project();
  mkdirSync(join(dir, 'nested'));
  writeFileSync(join(dir, '.env'), 'UNRELATED=private\nGOAL_ROOT_PATH="docs/goal with spaces"\n');

  const result = resolveArtifacts(join(dir, 'nested'), {});

  assert.deepEqual(result, { ok: true, value: {
    project: resolve(dir), root: join(resolve(dir), 'docs/goal with spaces'),
    plans: join(resolve(dir), 'docs/goal with spaces/plans'), runs: join(resolve(dir), 'docs/goal with spaces/runs'),
    source: '.env', supplied: true,
  } });
});

test('process then local then project sources win without reading lower-priority sources', () => {
  const dir = project();
  mkdirSync(join(dir, '.env'));
  writeFileSync(join(dir, '.env.local'), 'GOAL_ROOT_PATH=local\n');

  const local = resolveArtifacts(dir, {});
  const processValue = resolveArtifacts(dir, { GOAL_ROOT_PATH: 'process' });

  assert.equal(local.ok && local.value.source, '.env.local');
  assert.equal(processValue.ok && processValue.value.source, 'environment');
  assert.equal(processValue.ok && processValue.value.root, join(resolve(dir), 'process'));
});

for (const value of ['', '   ', 'bad\0path']) {
  test(`invalid selected value ${JSON.stringify(value)} never falls through`, () => {
    const dir = project();
    writeFileSync(join(dir, '.env.local'), 'GOAL_ROOT_PATH=valid\n');

    const result = resolveArtifacts(dir, { GOAL_ROOT_PATH: value });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes('GOAL_ROOT_PATH'));
  });
}

test('an unusable destination fails and a literal dollar expression is not expanded', () => {
  const dir = project();
  writeFileSync(join(dir, 'file'), 'blocked\n');
  writeFileSync(join(dir, '.env'), 'GOAL_ROOT_PATH="${HOME}/literal"\n');

  const invalid = resolveArtifacts(dir, { GOAL_ROOT_PATH: 'file/child' });
  const literal = resolveArtifacts(dir, {});

  assert.equal(invalid.ok, false);
  assert.equal(literal.ok && literal.value.root, join(resolve(dir), '${HOME}/literal'));
});

test('a missing variable defaults and an unreadable required source fails explicitly', () => {
  const dir = project();
  writeFileSync(join(dir, '.env.local'), 'UNRELATED=value\n');
  const absent = resolveArtifacts(dir, {});
  mkdirSync(join(dir, '.env'));

  const unreadable = resolveArtifacts(dir, {});

  assert.equal(absent.ok && absent.value.root, join(resolve(dir), '.goal'));
  assert.equal(absent.ok && absent.value.supplied, false);
  assert.ok(!unreadable.ok && unreadable.error.includes('.env'));
});

test('an empty local assignment overrides a valid project assignment with an error', () => {
  const dir = project();
  writeFileSync(join(dir, '.env.local'), 'GOAL_ROOT_PATH=\n');
  writeFileSync(join(dir, '.env'), 'GOAL_ROOT_PATH=valid\n');

  const result = resolveArtifacts(dir, {});

  assert.ok(!result.ok && result.error.includes('.env.local'));
});

test('the resolver CLI returns artifact metadata without exposing unrelated variables', () => {
  const dir = project();
  writeFileSync(join(dir, '.env'), 'UNRELATED=private-fixture-value\nGOAL_ROOT_PATH=docs/goal\n');

  const result = spawnSync('node', [resolve(import.meta.dirname, '../src/artifacts.ts'), dir], {
    env: { ...process.env, GOAL_ROOT_PATH: undefined }, encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).root, join(dir, 'docs/goal'));
  assert.doesNotMatch(result.stdout, /UNRELATED|private-fixture-value/);
});

test('an existing file where run records must be created is refused during resolution', () => {
  const dir = project();
  mkdirSync(join(dir, '.goal'));
  writeFileSync(join(dir, '.goal', 'runs'), 'not a directory\n');

  const result = resolveArtifacts(dir, {});

  assert.equal(result.ok, false);
});
