import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDiffGate } from '../src/diff.ts';

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'maintenance.auto';
process.env.GIT_CONFIG_VALUE_0 = 'false';

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

test('R7 — the diff gate ignores artifacts under a tests directory', () => {
  const repoRoot = initRepo();

  try {
    const base = git(repoRoot, 'rev-parse', 'HEAD').trim();
    const fixtureDir = join(
      repoRoot, 'plugins', 'demo', 'tests', 'fixtures', 'agent-plugins', 'nested', 'skills', 'invalid-skill',
    );
    mkdirSync(fixtureDir, { recursive: true });
    cpSync(fixture('invalid-skill'), fixtureDir, { recursive: true });
    commit(repoRoot, 'add test fixture');

    const result = runDiffGate(base, repoRoot);

    assert.equal(result.status, 'pass');
    assert.equal(result.verdicts.length, 0);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

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

test('the git this suite runs reads no global or system config and runs no maintenance', () => {
  const listed = git(tmpdir(), 'config', '--list', '--show-scope');

  assert.deepEqual(listed.split('\n').filter((line) => line !== ''), ['command\tmaintenance.auto=false']);
});
