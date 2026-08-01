import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GUARD = resolve(import.meta.dirname, '..', 'scripts', 'plan-guard.ts');

const PLAN = [
  '### Iteration 1 — A slice',
  '- [ ] Not done yet',
  '',
  '```gate',
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'commit_msg=feat(a): do a thing',
  'gate1=node --test tests/a.test.ts',
  '```',
  '',
  '## Definition of Done',
  '',
  '```gate',
  'dod1=npm test',
  '```',
  '',
].join('\n');

const writePlan = (content: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'plan-guard-')), 'spec.md');
  writeFileSync(path, content);

  return path;
};

const runGuard = (args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GUARD, ...args], { encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

test('a plan prints a hash of its gate and dod lines', () => {
  const plan = writePlan(PLAN);

  const { code, output } = runGuard([plan]);

  assert.equal(code, 0, output);
  assert.match(output, /^guard_hash=[0-9a-f]{64}$/m);
});

test('the same hash given back matches', () => {
  const plan = writePlan(PLAN);

  const hash = runGuard([plan]).output.trim().slice('guard_hash='.length);
  const { code, output } = runGuard([plan, hash]);

  assert.equal(code, 0, output);
  assert.match(output, /^OK/);
});

// R8 — a gate line rewritten since it was locked halts
test('a rewritten gate line is refused', () => {
  const plan = writePlan(PLAN);
  const hash = runGuard([plan]).output.trim().slice('guard_hash='.length);

  writeFileSync(plan, PLAN.replace('gate1=node --test tests/a.test.ts', 'gate1=true'));

  const { code, output } = runGuard([plan, hash]);

  assert.equal(code, 1, output);
  assert.match(output, /HALT/);
});

// R8 — a dod line rewritten since it was locked halts
test('a rewritten dod line is refused', () => {
  const plan = writePlan(PLAN);
  const hash = runGuard([plan]).output.trim().slice('guard_hash='.length);

  writeFileSync(plan, PLAN.replace('dod1=npm test', 'dod1=true'));

  const { code, output } = runGuard([plan, hash]);

  assert.equal(code, 1, output);
  assert.match(output, /HALT/);
});

// R8 — a change outside the gate/dod lines does not move the hash
test('a change that touches no gate or dod line does not move the hash', () => {
  const plan = writePlan(PLAN);
  const hash = runGuard([plan]).output.trim().slice('guard_hash='.length);

  writeFileSync(plan, PLAN.replace('A slice', 'A renamed slice'));

  const { code, output } = runGuard([plan, hash]);

  assert.equal(code, 0, output);
});

test('an unreadable plan is a misuse, not a crash', () => {
  const { code, output } = runGuard(['/nonexistent/path/spec.md']);

  assert.equal(code, 2, output);
});

test('called with no plan at all is a misuse', () => {
  const { code, output } = runGuard([]);

  assert.equal(code, 2, output);
});
