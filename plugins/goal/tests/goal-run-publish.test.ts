import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FAKE_REPO, PLAN, git, repo, run } from './support/goal-run-harness.ts';
import { createPublisher } from '../scripts/run/publish.ts';
import type { Reporter } from '../scripts/run/report.ts';

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

const silentReporter: Reporter = {
  say: () => {},
  stop: () => {
    throw new Error('unexpected stop');
  },
  record: () => {},
  setLog: () => {},
};

// R1 — createPublisher exposes the state it already keeps, read directly off the object it
// returns rather than sniffed by the entrypoint from the messages it happens to emit: a new
// informational line added to publish() cannot silently change what the caller reads as blocked.
test('createPublisher exposes its own publish state directly on the object it returns', () => {
  const publisher = createPublisher(PLAN, PLAN, 'commit', 'origin', silentReporter, 'true');

  assert.equal(publisher.state.publishes, false);
  assert.equal(publisher.state.prOpen, false);
  assert.equal(publisher.state.blocked, false);

  publisher.publish('1');

  assert.equal(publisher.state.blocked, false, 'Policy: commit blocks nothing to publish, it never counts as a blocked publication');
});

const publish = (fixture: ReturnType<typeof repo>, args: string[], env: Record<string, string> = {}) =>
  run(fixture, args, { FAKE_GATE_COMMITS: '1', ...env });

// R10 — under commit+pr, a landed iteration is scanned for secrets before it is pushed. A
// scanner refusal blocks the push rather than publishing whatever the branch carries.
test('a secret scanner refusal blocks the push, and no pull request is attempted', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_SCAN_EXIT: '1',
  });

  assert.equal(code, 0, output);
  assert.match(output, /scanner refused/i, output);
  assert.ok(!existsSync(fixture.ghLog), `a pull request was attempted though the scan refused:\n${output}`);
  assert.equal(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, '', 'the branch was pushed though the scan refused it');
});

// R11 — the push targets exactly the plan's declared remote, never a bare default, and the
// remote named is never guessed from `gh`'s own resolution.
test('a landed iteration under commit+pr is pushed to the plan\'s declared remote', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const heads = git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout;
  assert.match(heads, /feature\/demo/, `the branch never reached origin:\n${heads}`);
});

// R12 — a fixup or squash commit ahead of the first push refuses the push outright: the history
// pushed unattended has to be the sequence a reviewer would read.
test('a fixup commit ahead of the first push blocks it, and nothing is pushed', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GATE_COMMIT_MSG: 'fixup! stray edit',
  });

  assert.equal(code, 0, output);
  assert.match(output, /fixup|squash/i, output);
  assert.equal(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, '', 'the branch was pushed carrying a fixup commit');
});

// R13 — the pull request opens as a draft at the first landed commit, targeting the plan's
// declared `PR base:` line when it carries one.
test('the first landed iteration opens a draft pull request against the declared PR base', () => {
  const planText = PLAN_PR.replace('Remote: origin\n', 'Remote: origin\nPR base: develop\n');
  const fixture = repo({ planText, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /pr\ncreate/, `no pull request was created:\n${calls}`);
  assert.match(calls, /--draft/, calls);
  assert.match(calls, /--base\ndevelop/, `the declared PR base was not passed:\n${calls}`);
  assert.match(calls, new RegExp(FAKE_REPO), calls);
});

// R14 — a title containing a quote is refused rather than stripped, so the pull request never
// opens under a mangled title nobody wrote.
test('a plan title carrying a quote is refused, not stripped, and the branch stays pushed', () => {
  const planText = PLAN_PR.replace('# Spec: demo\n', "# Spec: demo's run\n");
  const fixture = repo({ planText, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(output, /quote/i, output);
  assert.ok(!existsSync(fixture.ghLog), `a pull request was attempted with an unsafe title:\n${output}`);
  assert.match(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, /feature\/demo/, 'the branch should already be pushed by the time the title is checked');
});

// R15 — every landing after the first rewrites the same pull request's body instead of
// creating another one.
test('a second landing rewrites the pull request body instead of creating a second one', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
  const creates = calls.filter((call) => call.startsWith('pr\ncreate'));
  const edits = calls.filter((call) => call.startsWith('pr\nedit'));

  assert.equal(creates.length, 1, `expected exactly one create, got ${creates.length}:\n${calls.join('\n===\n')}`);
  assert.equal(edits.length, 1, `expected exactly one edit, got ${edits.length}:\n${calls.join('\n===\n')}`);
});

// R15 — resuming a single iteration after a pull request already exists edits it rather than
// attempting to create a duplicate: `gh pr view` is asked, not assumed, so a run resumed by hand
// after a first invocation stays idempotent.
test('resuming a single iteration when the pull request already exists edits it, and never recreates it', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '2'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'b.txt'),
    FAKE_GH_PR_EXISTS: '1',
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /pr\nedit/, `the existing pull request was not edited:\n${calls}`);
  assert.ok(!calls.includes('pr\ncreate'), `a second pull request was created though one already existed:\n${calls}`);
});

// Under Policy: commit (no `+pr`), nothing is pushed and no pull request is opened — the plan
// asked the developer to keep the commits on the branch.
test('a plan under Policy: commit is never pushed and opens no pull request', () => {
  const fixture = repo({ remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(!existsSync(fixture.ghLog), `a pull request was attempted under Policy: commit:\n${output}`);
  assert.equal(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, '', 'the branch was pushed under Policy: commit');
});
