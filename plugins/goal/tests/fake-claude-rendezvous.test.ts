import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { repo } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';

const fakeClaude = (fixture: ReturnType<typeof repo>, agent: string, dir: string, deadlineMs: number) => {
  const env = {
    ...process.env,
    PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
    FAKE_CLAUDE_RENDEZVOUS: dir,
    FAKE_CLAUDE_RENDEZVOUS_DEADLINE_MS: String(deadlineMs),
  };

  return { args: ['--agent', `goal-run-${agent}`], env, cwd: fixture.dir };
};

const verdict = (dir: string, agent: string) => readFileSync(join(dir, `${agent}.verdict`), 'utf8');

test('R7 a lens and a reviewer started together both read their rendezvous as met', async () => {
  const fixture = repo();
  const dir = tmpDir('goal-rendezvous-');
  const lens = fakeClaude(fixture, 'lens', dir, 10_000);
  const reviewer = fakeClaude(fixture, 'reviewer', dir, 10_000);
  const exited = (spec: typeof lens) =>
    new Promise<void>((done) => spawn('claude', spec.args, { env: spec.env, cwd: spec.cwd, stdio: 'ignore' }).once('exit', () => done()));

  await Promise.all([exited(lens), exited(reviewer)]);

  assert.equal(verdict(dir, 'lens').trim(), 'met');
  assert.equal(verdict(dir, 'reviewer').trim(), 'met');
});

test('R7 a reviewer that starts after the lens has finished turns the lens verdict into never ran concurrently', () => {
  const fixture = repo();
  const dir = tmpDir('goal-rendezvous-');
  const lens = fakeClaude(fixture, 'lens', dir, 300);
  const reviewer = fakeClaude(fixture, 'reviewer', dir, 300);

  spawnSync('claude', lens.args, { env: lens.env, cwd: lens.cwd });
  spawnSync('claude', reviewer.args, { env: reviewer.env, cwd: reviewer.cwd });

  assert.match(verdict(dir, 'lens'), /never ran concurrently/);
  assert.match(verdict(dir, 'reviewer'), /never ran concurrently/);
});

test('R7 a lens with no reviewer reads a verdict naming the reviewer as missing', () => {
  const fixture = repo();
  const dir = tmpDir('goal-rendezvous-');
  const lens = fakeClaude(fixture, 'lens', dir, 300);

  spawnSync('claude', lens.args, { env: lens.env, cwd: lens.cwd });

  assert.match(verdict(dir, 'lens'), /reviewer.*missing/);
});
