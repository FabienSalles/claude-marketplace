import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FAKE_REPO, HASH, PLAN, git, repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';
import { createPublisher } from '../scripts/run/publish.ts';
import { close, LANDED } from '../scripts/run/close.ts';
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

// A `gh` stub that answers `pr view` with the given JSON body and swallows every other call, so
// a test can drive `createPublisher` straight through a chosen `gh pr view` response instead of
// the shared harness's fixture, which never carries a `state`.
const publishAgainstPrView = (
  fixture: ReturnType<typeof repo>,
  prView: string,
  iteration: string,
): { calls: string; publisher: ReturnType<typeof createPublisher> } => {
  const ghBin = tmpDir('goal-run-stub-gh-');
  const ghLog = join(ghBin, 'gh-calls.txt');

  writeFileSync(
    join(ghBin, 'gh'),
    `#!/bin/sh
printf -- '--- call ---\\n%s\\n' "$*" >> ${ghLog}
case "$1 $2" in
  "pr view")   printf '%s\\n' '${prView}'; exit 0 ;;
  *)           exit 0 ;;
esac
`,
  );
  chmodSync(join(ghBin, 'gh'), 0o755);

  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  process.chdir(fixture.dir);
  process.env.PATH = `${ghBin}:${fixture.bin}:${originalPath ?? ''}`;

  try {
    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', silentReporter, 'true');

    publisher.publish(iteration);

    return { calls: readFileSync(ghLog, 'utf8'), publisher };
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
};

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

// R14 — a title carrying an apostrophe opens its pull request normally: every `gh` call passes
// argv, never a shell, so nothing about the title needs quoting in the first place.
test('a plan title carrying an apostrophe opens a pull request rather than being refused', () => {
  const planText = PLAN_PR.replace('# Spec: demo\n', "# Spec: demo's run\n");
  const fixture = repo({ planText, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /quote/i, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /demo's run/, `the apostrophe title never reached the pull request create call:\n${calls}`);
  assert.match(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, /feature\/demo/, output);
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
  const { calls } = publishAgainstPrView(fixture, '{"number":1,"state":"OPEN"}', '2');

  assert.match(calls, /pr view/, `the existing pull request was never looked up:\n${calls}`);
  assert.match(calls, /pr edit/, `the existing pull request was not edited:\n${calls}`);
  assert.ok(!calls.includes('pr create'), `a second pull request was created though one already existed:\n${calls}`);
});

// R7 — a pull request `gh` still resolves by branch name after it was merged or closed is not
// this run's open one: its state is read alongside its number, and only OPEN keeps it that way.
test('a pull request already merged is not treated as open, and a new one is opened instead of edited', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  const ghBin = tmpDir('goal-run-merged-gh-');
  const ghLog = join(ghBin, 'gh-calls.txt');

  writeFileSync(
    join(ghBin, 'gh'),
    `#!/bin/sh
printf -- '--- call ---\\n%s\\n' "$*" >> ${ghLog}
case "$1 $2" in
  "pr view")   printf '{"number":28,"state":"MERGED"}\\n'; exit 0 ;;
  *)           exit 0 ;;
esac
`,
  );
  chmodSync(join(ghBin, 'gh'), 0o755);

  process.chdir(fixture.dir);
  process.env.PATH = `${ghBin}:${fixture.bin}:${originalPath ?? ''}`;

  try {
    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', silentReporter, 'true');

    publisher.publish('1');

    const calls = readFileSync(ghLog, 'utf8');
    assert.match(calls, /pr view/, `the merged pull request was never looked up:\n${calls}`);
    assert.match(calls, /pr create/, `a merged pull request was edited instead of opening a new one:\n${calls}`);
    assert.ok(!calls.includes('pr edit'), `a merged pull request was edited as though it were still open:\n${calls}`);
    assert.equal(publisher.state.prOpen, true, 'the newly opened pull request should be reflected in the publisher\'s own state');
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R7 — a pull request `gh` reports under a state this code does not recognize (a future value
// neither MERGED, CLOSED nor OPEN) is not treated as this run's open one: only OPEN keeps it
// that way, everything else opens a new one instead of editing.
test('a pull request under an unrecognized future state is not treated as open', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const { calls } = publishAgainstPrView(fixture, '{"number":28,"state":"MERGE_QUEUE"}', '1');

  assert.match(calls, /pr view/, `the pull request was never looked up:\n${calls}`);
  assert.match(calls, /pr create/, `an unrecognized state was treated as open instead of opening a new one:\n${calls}`);
  assert.ok(!calls.includes('pr edit'), `an unrecognized state was edited as though it were still open:\n${calls}`);
});

// PR body carries the report at close — close() folds the auditor's own report into the pull
// request body through publish.ts's existing body-rewrite path, never as a comment.
test('close folds the auditor\'s report into the pull request body, not as a comment', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const dir = tmpDir('goal-run-report-');
  writeFileSync(join(dir, 'report.md'), '# Report\n\nCosts: 3 iterations, $1.20.\n');

  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', silentReporter, 'true');
    publisher.state.prOpen = true;

    const code = close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', publisher, ['1'], dir, silentReporter);

    assert.equal(code, LANDED);
    const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
    const edits = calls.filter((call) => call.startsWith('pr\nedit'));

    assert.ok(edits.length > 0, `no pull request edit carried the run report:\n${calls.join('\n===\n')}`);
    assert.match(edits[edits.length - 1]!, /## Run report/, `no "## Run report" section was folded into the pull request body:\n${edits.join('\n===\n')}`);
    assert.match(edits[edits.length - 1]!, /Costs: 3 iterations, \$1\.20\./, `the auditor's own report text was not carried into the pull request body:\n${edits.join('\n===\n')}`);
    assert.ok(!calls.some((call) => call.startsWith('pr\ncomment')), `the report was posted as a comment rather than folded into the pull request body:\n${calls.join('\n===\n')}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// PR body carries the report at close — a second close() on the same pull request replaces the
// report section rather than appending another one beside it.
test('a second close() replaces the run report section instead of appending to it', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const dir = tmpDir('goal-run-report-rerun-');
  const reportPath = join(dir, 'report.md');

  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', silentReporter, 'true');
    publisher.state.prOpen = true;

    writeFileSync(reportPath, 'First run: nothing recurring.\n');
    close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', publisher, ['1'], dir, silentReporter);

    writeFileSync(reportPath, 'Second run: same halt as before.\n');
    close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', publisher, ['2'], dir, silentReporter);

    const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
    const edits = calls.filter((call) => call.startsWith('pr\nedit'));
    const last = edits[edits.length - 1]!;

    assert.match(last, /Second run: same halt as before\./, `the second report never reached the pull request body:\n${last}`);
    assert.ok(!last.includes('First run: nothing recurring.'), `the first run's report was still there instead of replaced:\n${last}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// PR body format — the body opens with "## Delivered" and one numbered bullet per landed
// iteration, derived from its own Goal line and ending with the commit sha that landed it,
// never a bare title list.
test('the pull request body opens with Delivered bullets built from the Goal line and commit sha', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const sha = git(fixture.dir, 'rev-parse', '--short', 'HEAD').stdout.trim();
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /## Delivered/, `no "## Delivered" heading in the pull request body:\n${calls}`);
  assert.match(
    calls,
    new RegExp(`1\\. write a\\.txt ${sha}`),
    `no numbered bullet carrying the Goal and the bare landing commit sha:\n${calls}`,
  );
  assert.doesNotMatch(calls, new RegExp(`\`${sha}\``), `the sha is wrapped in backticks instead of bare:\n${calls}`);
  assert.doesNotMatch(calls, /judged by the gate/i, `the certification boilerplate is still in the pull request body:\n${calls}`);
});

// PR body format — a second landing appends a second numbered bullet rather than replacing the
// first, each derived from its own iteration's Goal and its own commit sha.
test('a second landing adds a second numbered Delivered bullet, each with its own commit sha', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
  const edits = calls.filter((call) => call.startsWith('pr\nedit'));
  const last = edits[edits.length - 1]!;

  assert.match(last, /1\. write a\.txt [0-9a-f]+\b/, `first Delivered bullet missing:\n${last}`);
  assert.match(last, /2\. write b\.txt [0-9a-f]+\b/, `second Delivered bullet missing:\n${last}`);
});

// PR body format — a Goal spanning several lines in the plan folds to one line in the bullet,
// continuation lines joined with spaces up to the next `- **` bullet or blank line.
test('a multi-line Goal folds to one line in its Delivered bullet', () => {
  const planText = PLAN_PR.replace(
    '- **Goal:** write a.txt\n',
    '- **Goal:** write a.txt with a long description that\n  continues on a second line and even\n  a third line before the gate block.\n',
  );
  const fixture = repo({ planText, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(
    calls,
    /1\. write a\.txt with a long description that continues on a second line and even a third line before the gate block\./,
    `the multi-line Goal was not folded to one line:\n${calls}`,
  );
});

// PR body format — a plan named `issue-<N>-spec.md` carries `Closes #N` in its Delivered
// section, so the merge closes the backing issue.
test('a plan named issue-<N>-spec.md carries a Closes line in the pull request body', () => {
  const fixture = repo({ planText: PLAN_PR, planFile: 'issue-42-spec.md', branch: 'feature/issue-42', remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /Closes #42/, `no "Closes #42" line in the pull request body:\n${calls}`);
});

// PR body format — a plan not named `issue-<N>-spec.md` carries no Closes line: closing an
// issue is only inferred from the plan's own filename, never guessed.
test('a plan not named issue-<N>-spec.md carries no Closes line', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = publish(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.doesNotMatch(calls, /Closes #/, `an unexpected Closes line appeared in the pull request body:\n${calls}`);
});

// PR body format — the run report lands behind a `---` separator, never immediately after the
// Delivered list, so the machine-written summary and the auditor's own prose stay visually apart.
test('close folds the run report behind a --- separator from the Delivered list', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const dir = tmpDir('goal-run-report-sep-');
  writeFileSync(join(dir, 'report.md'), '# Report\n\nCosts: 3 iterations.\n');

  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', silentReporter, 'true');
    publisher.state.prOpen = true;

    const code = close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', publisher, ['1'], dir, silentReporter);

    assert.equal(code, LANDED);
    const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
    const edits = calls.filter((call) => call.startsWith('pr\nedit'));
    const last = edits[edits.length - 1]!;

    assert.match(last, /\n---\n\n## Run report\n/, `the run report was not folded behind a "---" separator:\n${last}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
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
