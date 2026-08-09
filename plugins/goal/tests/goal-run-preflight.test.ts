import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN, git, lockOf, repo, run } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';

// R8 — the twelve preflight conditions run before the lock is taken, as refusals rather than
// warnings. A run that would have burned a night on a red base, a stale branch or an absent
// remote refuses in seconds instead.

// R1 — a plan without the `---`-delimited metadata block is refused before anything else runs,
// with the exact block to paste back into the plan.
test('it refuses before any other check when the plan carries no --- metadata block', () => {
  const planText = PLAN.replace('---\nPolicy: commit\nRemote: origin\n---\n', 'Policy: commit\nRemote: origin\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the plan declares no `---`-delimited metadata block/, output);
  assert.match(output, /---\nPolicy: commit\nRemote: origin\n---/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan declares no Policy line', () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the plan declares no Policy line/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan is Policy: manual', () => {
  const fixture = repo({ planText: PLAN.replace('Policy: commit', 'Policy: manual') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP Policy is manual, so nothing may be committed and there is nothing to run unattended\. Change the Policy line in the spec, or run the manual loop with \/goal and \/goal:next\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the plan declares no Remote line', () => {
  const fixture = repo({ planText: PLAN.replace('Remote: origin\n', '') });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the plan declares no Remote line/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the checkout stands on the wrong branch', () => {
  const fixture = repo({ branch: null });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the checkout stands on main, not feature\/demo \(or feature\/demo-\.\.\.\)/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test("it refuses when .claude/goal-runs is visible to git, naming the directory and the gitignore line, before the clean-tree check", () => {
  const fixture = repo();
  writeFileSync(join(fixture.dir, '.gitignore'), 'fake-bin/\n*-args.txt\n');
  git(fixture.dir, 'add', '.gitignore');
  git(fixture.dir, 'commit', '-qm', 'narrow gitignore');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP \.claude\/goal-runs is visible to git\. Add it to \.gitignore:\n\.claude\/goal-runs/, output);
  assert.ok(!output.includes('STOP the tree is not clean'), output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it is valid on a first run, before .claude/goal-runs ever exists', () => {
  const fixture = repo();

  assert.ok(!existsSync(join(fixture.dir, '.claude', 'goal-runs')), 'the fixture already carries a goal-runs directory');

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), 'a git-ignored but absent goal-runs directory still refused the run');
});

test('it refuses when the tree carries uncommitted work', () => {
  const fixture = repo();
  writeFileSync(join(fixture.dir, 'stray.txt'), 'oops\n');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the tree is not clean:\n\?\? stray\.txt/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test("it refuses when the plan's own directory is visible to git", () => {
  const fixture = repo({ trackPlan: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP the plan's directory is visible to git: .*plans\. Ignore it, untracking any spec already committed\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses a cleanup iteration (a Trigger line) sitting inside a feature plan', () => {
  const planText = PLAN.replace(
    '### Iteration 2 — the second one\n- [ ] Not done yet',
    '### Iteration 2 — the second one\n- [ ] Not done yet\n- **Trigger:** flag at 100% for 7 days',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(
    output,
    /STOP the plan carries a cleanup iteration \(a Trigger: line\) inside a feature plan\. Move it out with \/goal:run-issue, or run the \*-cleanup-spec\.md plan directly\./,
    output,
  );
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('a Trigger line is left alone in a *-cleanup-spec.md plan', () => {
  const planText = PLAN.replace(
    '### Iteration 2 — the second one\n- [ ] Not done yet',
    '### Iteration 2 — the second one\n- [ ] Not done yet\n- **Trigger:** flag at 100% for 7 days',
  );
  const fixture = repo({ planText, planFile: 'demo-cleanup-spec.md' });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(existsSync(fixture.claudeLog), 'the cleanup plan never reached an implementer');
});

test('it refuses when another run already holds the plan', () => {
  const fixture = repo();
  mkdirSync(lockOf(fixture));

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, new RegExp(`STOP another run holds this plan: ${lockOf(fixture)}\\. Wait for it, or free it with:`), output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when the base is already red', () => {
  const planText = PLAN.replace(
    '### Iteration 1',
    '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1',
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1 before this run wrote a line:/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses when a later gate in the sweep (gate2..N) fails on the untouched tree', () => {
  const planText = PLAN.replace('gate1=true\n', 'gate1=true\ngate2=false\n');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the base is not green: `false` exited 1 before this run wrote a line:/, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('the base sweep is skipped while the Bootstrap iteration is still unchecked', () => {
  const planText = PLAN.replace(
    'Policy: commit\n',
    'Policy: commit\nBootstrap: 1\n',
  ).replace('### Iteration 1', '## Definition of Done\n\n```gate\ndod1=false\n```\n\n### Iteration 1');
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(output, /RUN base sweep skipped: Bootstrap iteration 1 is not built yet/, output);
  assert.ok(existsSync(fixture.claudeLog), 'the run never reached the implementer under an exempted sweep');
});

test('it refuses when the branch is behind the base it forked from', () => {
  const fixture = repo({ staleOrigin: true });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the branch is behind origin\/main:\n.*ahead commit\n\nFetch and rebase before relaunching\./s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

// R4 — the branch-behind check is verified against the base the plan declares, not always
// origin/HEAD: a `PR base:` header names it directly, or a `Remote:` header naming a fork falls
// back to that fork's own default branch, before either falls back to origin/HEAD.

test('it refuses against the plan\'s PR base:, even while origin/HEAD stays green', () => {
  const fixture = repo({ remote: true, prBase: 'release' });

  // origin/main tracks this checkout exactly, so origin/HEAD stays green; origin/release, only
  // reachable through the plan's PR base: header, carries the commit this checkout never got.
  git(fixture.dir, 'push', '-q', 'origin', 'HEAD:main');
  git(fixture.dir, 'fetch', '-q', 'origin');
  git(fixture.dir, 'remote', 'set-head', 'origin', '-a');
  git(fixture.dir, 'checkout', '-qb', 'release-ahead');
  writeFileSync(join(fixture.dir, 'ahead.txt'), 'ahead\n');
  git(fixture.dir, 'add', '-A');
  git(fixture.dir, 'commit', '-qm', 'ahead commit');
  git(fixture.dir, 'push', '-q', 'origin', 'release-ahead:release');
  git(fixture.dir, 'checkout', '-q', 'feature/demo');
  git(fixture.dir, 'branch', '-D', 'release-ahead');

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the branch is behind origin\/release:\n.*ahead commit\n\nFetch and rebase before relaunching\./s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

test('it refuses against <remote>/HEAD when the plan declares no PR base, so a fork is checked against itself', () => {
  const planText = PLAN.replace('Remote: origin\n', 'Remote: fork\n');
  const fixture = repo({ planText, staleBase: { remote: 'fork', branch: 'main' } });

  const { code, output } = run(fixture, [fixture.plan, '1']);

  assert.notEqual(code, 0);
  assert.match(output, /STOP the branch is behind fork\/main:\n.*ahead commit\n\nFetch and rebase before relaunching\./s, output);
  assert.ok(!existsSync(fixture.claudeLog), 'an implementer was spawned on a refusal');
});

// R2 — the base sweep runs each distinct declared command once, however many times the plan
// repeats it across iterations, instead of replaying every occurrence.

test('a command declared identically by two iterations runs once, not once per declaration', () => {
  const planText = PLAN.replace('gate1=true\n', 'gate1=true\ngate2=printf x >> sweep-count.txt\n').replace(
    '- **Goal:** write b.txt\n',
    [
      '- **Goal:** write b.txt\n',
      '',
      '```gate',
      'test_files=t2.txt',
      'impl_files=b.txt',
      'max_diff=50',
      'commit_msg=feat: b',
      'gate1=true',
      'gate2=printf x >> sweep-count.txt',
      '```\n',
    ].join('\n'),
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.equal(
    readFileSync(join(fixture.dir, 'sweep-count.txt'), 'utf8'),
    'x',
    'the command declared by both iterations ran more than once',
  );
});

// R3 — the sweep announces how many distinct commands it ran against how many the plan declared,
// and every one of the nine preflight checks narrates on stdout once it passes, so the run reads
// as a sequence rather than silence.

test('the sweep announces the reduction from declared commands to the distinct ones it ran', () => {
  const planText = PLAN.replace('gate1=true\n', 'gate1=true\ngate2=printf x >> sweep-count.txt\n').replace(
    '- **Goal:** write b.txt\n',
    [
      '- **Goal:** write b.txt\n',
      '',
      '```gate',
      'test_files=t2.txt',
      'impl_files=b.txt',
      'max_diff=50',
      'commit_msg=feat: b',
      'gate1=true',
      'gate2=printf x >> sweep-count.txt',
      '```\n',
    ].join('\n'),
  );
  const fixture = repo({ planText });

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /RUN base sweep: 1 distinct command run, 2 declared/, output);
});

// R10 — a settings.json that neither disables the auto-updater nor pins autoUpdatesChannel to
// stable is a warning, not a refusal: the run continues, the implementer is spawned, and the
// warning names the risk once on stdout.

test('it warns but continues when settings.json neither disables the auto-updater nor pins a stable channel', () => {
  const fixture = repo();
  const settingsPath = join(tmpDir('goal-run-settings-'), 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({ autoUpdatesChannel: 'latest' }));

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_SETTINGS_PATH: settingsPath,
  });

  assert.equal(code, 0, output);
  assert.match(output, /RUN preflight: warning — this machine's auto-updater can replace the Claude Code binary mid-run and kill it/, output);
  assert.ok(existsSync(fixture.claudeLog), 'the warning stopped the run reaching the implementer');
});

test('it does not warn when env.DISABLE_AUTOUPDATER is set', () => {
  const fixture = repo();
  const settingsPath = join(tmpDir('goal-run-settings-'), 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({ env: { DISABLE_AUTOUPDATER: '1' } }));

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_SETTINGS_PATH: settingsPath,
  });

  assert.equal(code, 0, output);
  assert.ok(!output.includes('RUN preflight: warning'), output);
});

test('it does not warn when autoUpdatesChannel is stable', () => {
  const fixture = repo();
  const settingsPath = join(tmpDir('goal-run-settings-'), 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({ autoUpdatesChannel: 'stable' }));

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_SETTINGS_PATH: settingsPath,
  });

  assert.equal(code, 0, output);
  assert.ok(!output.includes('RUN preflight: warning'), output);
});

test('a missing settings.json produces no warning and no crash', () => {
  const fixture = repo();
  const settingsPath = join(tmpDir('goal-run-settings-'), 'nonexistent-settings.json');

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_SETTINGS_PATH: settingsPath,
  });

  assert.equal(code, 0, output);
  assert.ok(!output.includes('RUN preflight: warning'), output);
});

test('an unparseable settings.json produces no warning and no crash', () => {
  const fixture = repo();
  const settingsPath = join(tmpDir('goal-run-settings-'), 'invalid-settings.json');
  writeFileSync(settingsPath, 'not json');

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    GOAL_RUN_SETTINGS_PATH: settingsPath,
  });

  assert.equal(code, 0, output);
  assert.ok(!output.includes('RUN preflight: warning'), output);
});

test('every preflight check narrates on stdout once it passes', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt') });

  assert.equal(code, 0, output);
  assert.match(output, /RUN preflight: Policy is commit/, output);
  assert.match(output, /RUN preflight: Remote is origin/, output);
  assert.match(output, /RUN preflight: branch is feature\/demo/, output);
  assert.match(output, /RUN preflight: the tree is clean/, output);
  assert.match(output, /RUN preflight: plan directory .*\.claude\/plans is git-ignored/, output);
  assert.match(output, /RUN preflight: no cleanup iteration inside this feature plan/, output);
  assert.match(output, /RUN preflight: no other run holds the lock/, output);
  assert.match(output, /RUN base sweep: \d+ distinct commands? run, \d+ declared/, output);
  assert.match(output, /RUN preflight: branch is caught up with/, output);
});
