import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDiffGate } from '../src/diff.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', 'diff', name);

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' });

const initRepo = (): string => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'skills-diff-'));
  mkdirSync(join(repoRoot, 'plugins'), { recursive: true });
  writeFileSync(join(repoRoot, 'plugins', '.gitkeep'), '');
  git(repoRoot, 'init', '--quiet');
  git(repoRoot, 'config', 'user.email', 'test@example.com');
  git(repoRoot, 'config', 'user.name', 'Test');
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '--quiet', '-m', 'base');

  return repoRoot;
};

const commit = (repoRoot: string, message: string): string => {
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '--quiet', '-m', message);

  return git(repoRoot, 'rev-parse', 'HEAD').trim();
};

// R7 — a diff that only touches a compliant skill passes the gate.
test('R7 — the diff gate passes when the touched artifact is compliant', () => {
  const repoRoot = initRepo();

  try {
    const base = git(repoRoot, 'rev-parse', 'HEAD').trim();
    const skillDir = join(repoRoot, 'plugins', 'demo', 'skills', 'valid-skill');
    mkdirSync(skillDir, { recursive: true });
    cpSync(fixture('valid-skill'), skillDir, { recursive: true });
    commit(repoRoot, 'add valid-skill');

    const result = runDiffGate(base, repoRoot);

    assert.equal(result.status, 'pass');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// R7 — a diff that touches a non-compliant skill fails the gate exactly on that artifact.
test('R7 — the diff gate fails when the touched artifact is non-compliant', () => {
  const repoRoot = initRepo();

  try {
    const base = git(repoRoot, 'rev-parse', 'HEAD').trim();
    const skillDir = join(repoRoot, 'plugins', 'demo', 'skills', 'invalid-skill');
    mkdirSync(skillDir, { recursive: true });
    cpSync(fixture('invalid-skill'), skillDir, { recursive: true });
    commit(repoRoot, 'add invalid-skill');

    const result = runDiffGate(base, repoRoot);

    assert.equal(result.status, 'fail');
    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.status, 'fail');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// R7 — deleting a touched artifact is neutral: it never fails the gate, even when the artifact
// being removed was non-compliant.
test('R7 — deleting a touched artifact is neutral and does not fail the gate', () => {
  const repoRoot = initRepo();

  try {
    const skillDir = join(repoRoot, 'plugins', 'demo', 'skills', 'invalid-skill');
    mkdirSync(skillDir, { recursive: true });
    cpSync(fixture('invalid-skill'), skillDir, { recursive: true });
    const base = commit(repoRoot, 'add invalid-skill');

    rmSync(skillDir, { recursive: true, force: true });
    commit(repoRoot, 'remove invalid-skill');

    const result = runDiffGate(base, repoRoot);

    assert.equal(result.status, 'pass');
    assert.equal(result.verdicts.length, 0);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
