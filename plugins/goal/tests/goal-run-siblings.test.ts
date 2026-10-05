import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, PAUSED, repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';

const siblingOf = (fixture: ReturnType<typeof repo>): string => {
  const sibling = join(tmpDir('goal-run-sibling-'), 'sib');
  git(fixture.dir, 'worktree', 'add', '-q', '-b', 'sib', sibling);

  return sibling;
};

const claudeRunning = (fixture: ReturnType<typeof repo>, script: string) => {
  writeFileSync(join(fixture.bin, 'claude'), `#!/bin/sh\n${script}\nexit 0\n`);
  chmodSync(join(fixture.bin, 'claude'), 0o755);
};

const noteLines = (output: string, ref: string) => output.split('\n').filter((line) => line.includes(`RUN ${ref} `) && /not this run's work|was deleted/.test(line));

test('a sibling worktree pushing, and an implementer pushing a pre-existing commit, are noted once and the run goes on', () => {
  const fixture = repo({ remote: true });
  const sibling = siblingOf(fixture);
  const counter = join(fixture.dir, 'attempts');

  claudeRunning(
    fixture,
    `n=$(cat ${counter} 2>/dev/null || echo 0)
if [ "$n" -eq 0 ]; then
  echo 1 > ${counter}
  git -C ${sibling} commit --allow-empty -qm sibling
  git -C ${sibling} push -q origin HEAD:sibling-branch
  printf '{"type":"result","is_error":true,"result":"Claude AI usage limit reached|1735689600"}\\n'
  exit 1
fi
git push -q origin HEAD:preexisting
echo x >> a.txt`,
  );

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1', GOAL_RUN_QUOTA_SLEEP: '0' });

  assert.equal(code, 0, output);
  assert.equal(noteLines(output, 'refs/remotes/origin/sibling-branch').length, 1, output);
  assert.equal(noteLines(output, 'refs/remotes/origin/preexisting').length, 1, output);
});

test('a sibling worktree pruning a remote ref and deleting a branch is noted and the run goes on', () => {
  const fixture = repo({ remote: true });
  const sibling = siblingOf(fixture);

  git(fixture.dir, 'push', '-q', 'origin', 'HEAD:old');
  git(fixture.dir, 'branch', 'gone');
  const origin = git(fixture.dir, 'remote', 'get-url', 'origin').stdout.trim();

  claudeRunning(
    fixture,
    `git --git-dir=${origin} branch -D old
git -C ${sibling} fetch -q --prune origin
git -C ${sibling} branch -d gone
echo x >> a.txt`,
  );

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1' });

  assert.equal(code, 0, output);
  assert.equal(noteLines(output, 'refs/remotes/origin/old').length, 1, output);
  assert.equal(noteLines(output, 'refs/heads/gone').length, 1, output);
});

test('an implementer push concurrent with a sibling push pauses naming the push, with the sibling noted', () => {
  const fixture = repo({ remote: true });
  const sibling = siblingOf(fixture);

  claudeRunning(
    fixture,
    `git -C ${sibling} commit --allow-empty -qm sibling
git -C ${sibling} push -q origin HEAD:sibling-branch
git commit --allow-empty -qm work
git push -q origin HEAD:feat
git reset -q --soft HEAD~1`,
  );

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, PAUSED, output);
  assert.match(output, /the implementer pushed: refs\/remotes\/origin\/feat moved/, output);
  assert.doesNotMatch(output, /pushed:[^\n]*sibling-branch/, output);
  assert.equal(noteLines(output, 'refs/remotes/origin/sibling-branch').length, 1, output);
});

test('a sibling installing a hook pauses with wording that does not accuse the implementer', () => {
  const fixture = repo();
  const sibling = siblingOf(fixture);

  claudeRunning(fixture, `printf '#!/bin/sh\\n' > $(git -C ${sibling} rev-parse --path-format=absolute --git-common-dir)/hooks/pre-push\necho x >> a.txt`);

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.equal(code, PAUSED, output);
  assert.match(output, /the git directory changed under the run, possibly from another worktree/, output);
  assert.match(output, /hooks[/\\]pre-push/, output);
  assert.doesNotMatch(output, /the implementer changed/, output);
});

test('a sibling setting upstream tracking writes only harmless config entries, which are noted once', () => {
  const fixture = repo({ remote: true });
  const sibling = siblingOf(fixture);

  claudeRunning(
    fixture,
    `git -C ${sibling} commit --allow-empty -qm sibling
git -C ${sibling} push -q -u origin HEAD:sib
echo x >> a.txt`,
  );

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_GATE_COMMITS: '1' });

  assert.equal(code, 0, output);
  assert.equal(output.split('\n').filter((line) => /RUN config entry branch\.sib\.remote was added: noted/.test(line)).length, 1, output);
});
