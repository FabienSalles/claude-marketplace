import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { PAUSED, repo, run } from './support/goal-run-harness.ts';

const hookPath = (fixture: ReturnType<typeof repo>) => join(fixture.dir, '.git', 'hooks', 'pre-commit');

// The git-directory tamper check lives in goal-run.ts only; goal-run.sh is frozen and never
// gained it. Skipped rather than failed when the suite falls back to bash.
const NODE_ONLY = process.env.GOAL_RUN_IMPL !== 'node' ? 'this check ported to goal-run.ts only, not goal-run.sh yet' : false;

// R5 (I3) — a file inside .git/ is executable surface the gate never spawns as `node`, but
// goal-run.sh does: an implementer that plants one there is a back door, not a contribution, and
// `git status` never shows it. The run has to catch this itself, before asking the gate anything.
test('the implementer changing a file inside .git/ halts the run, naming the artifact', { skip: NODE_ONLY }, () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: hookPath(fixture),
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /git directory/i, output);
  assert.match(output, /\.git\//, output);
  assert.match(output, /hooks[/\\]pre-commit/, output);
});

// R5 (I3) — order matters: an implementer that writes only into .git/ leaves the tree itself
// clean, so the git-directory check has to run before the empty-tree case reads that silence as
// "wrote nothing" instead of naming what actually happened.
test('a git-directory tamper is diagnosed by name, not read as an empty tree', { skip: NODE_ONLY }, () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: hookPath(fixture),
  });

  assert.equal(code, PAUSED, output);
  assert.doesNotMatch(output, /wrote nothing/i, output);
});

// R5 (I3) — HEAD is still checked first: a self-committed implementer is diagnosed as that, the
// git-directory check never runs ahead of it and never masks that diagnosis.
test('a self-committed implementer is still diagnosed as that, unaffected by the new check', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /committed on its own/i, output);
  assert.doesNotMatch(output, /git directory/i, output);
});

// R5 (I8) — the snapshot is taken once, before the quota-retry loop. A tamper on attempt 1 must
// still be caught after a quota failure sends the same iteration to attempt 2 and it lands: a
// fresh snapshot per attempt would use attempt 1's tamper as its own baseline and erase it.
test('a tamper on the first attempt survives a quota failure and retry', { skip: NODE_ONLY }, () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_QUOTA_UNTIL: '1',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    FAKE_CLAUDE_WRITES: hookPath(fixture),
    GOAL_RUN_QUOTA_SLEEP: '0',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /git directory/i, output);
  assert.match(output, /hooks[/\\]pre-commit/, output);
});

// The false-positive side: an ordinary run that never touches .git/ still lands past this check.
test('an ordinary run that never touches .git/ is not stopped by this check', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /git directory/i, output);
});
