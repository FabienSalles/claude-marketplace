// R8 — mutate.sh must fail loudly when the test file it targets is missing, not read the spawn
// failure that follows as "the mutation turned it red".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const MUTATE = join(REPO_ROOT, 'plugins', 'goal', 'tests', 'support', 'mutate.sh');

test('mutate.sh fails when its target test file does not exist, instead of passing', () => {
  const repo = tmpDir('mutate-guard-');
  const supportDir = join(repo, 'plugins', 'goal', 'tests', 'support');

  mkdirSync(supportDir, { recursive: true });
  cpSync(MUTATE, join(supportDir, 'mutate.sh'));

  const result = spawnSync('bash', [join(supportDir, 'mutate.sh')], { cwd: repo, encoding: 'utf8' });

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /not found/);
});
