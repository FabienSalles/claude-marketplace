import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';

// The ref-watch check lives in goal-run.ts only; goal-run.sh is frozen and never gained it.
// Skipped rather than failed when the suite falls back to bash.
const NODE_ONLY = process.env.GOAL_RUN_IMPL !== 'node' ? 'this check ported to goal-run.ts only, not goal-run.sh yet' : false;

// Rewrites the fixture's fake claude to run a shell snippet that moves a ref the shared fixture
// never touches: `for-each-ref` unqualified is the only way to see the move, `git status` never
// will, since the snippet leaves the working tree itself clean.
const claudeRunning = (fixture: ReturnType<typeof repo>, script: string) => {
  writeFileSync(join(fixture.bin, 'claude'), `#!/bin/sh\n${script}\nexit 0\n`);
  chmodSync(join(fixture.bin, 'claude'), 0o755);
};

// R8 — the snapshot used to stop at `refs/remotes`, so a stash left `git status` clean and the
// run read it as "the implementer wrote nothing", the same class of wrong answer as the `.git/`
// blind spot the runner already closes. Widened to every ref, the stash itself halts the run.
test('git stash push halts the run, naming refs/stash rather than reading an empty tree', { skip: NODE_ONLY }, () => {
  const fixture = repo();
  claudeRunning(fixture, 'echo wip >> stashed.txt\ngit stash push -q -u');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, PAUSED, output);
  assert.match(output, /refs\/stash/, output);
  assert.match(output, /git status/i, output);
  assert.doesNotMatch(output, /wrote nothing/i, output);
});

// R8 — a tag moves exactly as invisibly to `git status` as a stash does, and is caught the same
// way: named, not folded into "wrote nothing".
test('a tag created by the implementer halts the run, naming it', { skip: NODE_ONLY }, () => {
  const fixture = repo();
  claudeRunning(fixture, 'git tag mytag');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, PAUSED, output);
  assert.match(output, /refs\/tags\/mytag/, output);
});

// R8 — a moved `refs/remotes/*` keeps its existing diagnosis: the widened snapshot adds a halt
// for everything else without changing what a push is read as.
test('a push still reads as a push, unaffected by the widened ref snapshot', { skip: NODE_ONLY }, () => {
  const fixture = repo({ remote: true });

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_PUSHES: '1' });

  assert.equal(code, PAUSED, output);
  assert.match(output, /pushed/i, output);
  assert.match(output, /refs\/remotes\/origin\//, output);
});

// The false-positive side: an ordinary run that moves no ref at all still lands.
test('an ordinary run that moves no ref is not stopped by this check', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /the implementer (pushed|moved)/i, output);
});
