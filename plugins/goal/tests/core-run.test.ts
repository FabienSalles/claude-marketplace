import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  caughtUpWithBase,
  featureBranch,
  cleanTree,
  noCleanupIteration,
  goalRunsIgnored,
  freeLock,
  metadataDeclared,
  planDirIgnored,
  runnablePolicy,
  remoteDeclared,
} from '../src/core/preflight.ts';
import { detectTamper, type TreeState } from '../src/core/tamper.ts';
import { HALTED, LANDED, PAUSED, REFUSED } from '../src/core/verdict.ts';
import { classifyQuotaFailure } from '../src/run/quota.ts';

// P9/J8 — the runner's decisions are pure functions proven in-process: no spawn, no filesystem,
// no exit code. The ten preflight checks, the quota classification and the tamper detection
// all reduce to a Result the caller decides what to do with.

const CTX = { plan: '/tmp/demo/plan.md', workId: 'demo', gate: 'node goal-gate.ts' };

test('metadataDeclared refuses a plan with no --- block, carrying the legacy lines to paste back', () => {
  const missing = metadataDeclared(false, ['Policy: commit', 'Remote: origin']);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /no `---`-delimited metadata block/);
  assert.match(missing.error, /Policy: commit/);

  const present = metadataDeclared(true, []);
  assert.equal(present.ok, true);
});

test('runnablePolicy refuses an absent Policy line and a manual one, passes anything else through', () => {
  assert.equal(runnablePolicy(undefined).ok, false);
  assert.match((runnablePolicy(undefined) as { error: string }).error, /no Policy line/);

  const manual = runnablePolicy('manual');
  assert.equal(manual.ok, false);
  assert.match((manual as { error: string }).error, /nothing may be committed/);

  const result = runnablePolicy('commit');
  assert.equal(result.ok, true);
  assert.equal((result as { value: string }).value, 'commit');
});

test('remoteDeclared refuses an absent Remote line, passes a declared one through', () => {
  assert.equal(remoteDeclared(undefined).ok, false);
  assert.equal(remoteDeclared('').ok, false);

  const result = remoteDeclared('origin');
  assert.equal(result.ok, true);
  assert.equal((result as { value: string }).value, 'origin');
});

test('featureBranch refuses outside a git repository and off the plan\'s own branch', () => {
  const notGit = featureBranch(false, 'main', CTX.workId);
  assert.equal(notGit.ok, false);
  assert.match((notGit as { error: string }).error, /not a git repository/);

  const wrongBranch = featureBranch(true, 'main', CTX.workId);
  assert.equal(wrongBranch.ok, false);
  assert.match((wrongBranch as { error: string }).error, /stands on main, not feature\/demo/);

  assert.equal(featureBranch(true, 'feature/demo', CTX.workId).ok, true);
  assert.equal(featureBranch(true, 'feature/demo-more', CTX.workId).ok, true);
});

test('goalRunsIgnored and planDirIgnored refuse a directory git can see', () => {
  const visible = goalRunsIgnored(false, '.claude/goal-runs');
  assert.equal(visible.ok, false);
  assert.match((visible as { error: string }).error, /\.claude\/goal-runs is visible to git/);
  assert.equal(goalRunsIgnored(true, '.claude/goal-runs').ok, true);

  const planDir = planDirIgnored(false, '.claude/plans');
  assert.equal(planDir.ok, false);
  assert.match((planDir as { error: string }).error, /plan's directory is visible to git: \.claude\/plans/);
  assert.equal(planDirIgnored(true, '.claude/plans').ok, true);
});

test('cleanTree refuses uncommitted work, carrying the git status', () => {
  const dirty = cleanTree('?? stray.txt');
  assert.equal(dirty.ok, false);
  assert.match((dirty as { error: string }).error, /the tree is not clean:\n\?\? stray\.txt/);
  assert.equal(cleanTree('').ok, true);
});

test('noCleanupIteration refuses a Trigger line inside a feature plan, spares a cleanup plan', () => {
  const leaked = noCleanupIteration(false, true);
  assert.equal(leaked.ok, false);
  assert.match((leaked as { error: string }).error, /cleanup iteration \(a Trigger: line\) inside a feature plan/);

  assert.equal(noCleanupIteration(true, true).ok, true);
  assert.equal(noCleanupIteration(false, false).ok, true);
});

test('freeLock refuses a plan another run already holds, naming the unlock command', () => {
  const held = freeLock(true, `${CTX.plan}.run.lock`, `${CTX.gate} unlock ${CTX.plan}`);
  assert.equal(held.ok, false);
  assert.match((held as { error: string }).error, /another run holds this plan: .*\.run\.lock/);
  assert.match((held as { error: string }).error, /free it with: node goal-gate\.ts unlock/);

  assert.equal(freeLock(false, `${CTX.plan}.run.lock`, 'unlock hint').ok, true);
});

test('caughtUpWithBase refuses a branch behind its base, carrying the missing commits', () => {
  const behind = caughtUpWithBase(false, 'origin/main', 'abc123 ahead commit');
  assert.equal(behind.ok, false);
  assert.match((behind as { error: string }).error, /the branch is behind origin\/main:\nabc123 ahead commit/);

  assert.equal(caughtUpWithBase(true, 'origin/main', '').ok, true);
});

// P9 — quota classification is a declarative table, not a chain of if/else: the same fact
// (an explicit usage-limit message beats a bare 429 in the same output) still holds once the
// checks are rows instead of branches.
test('classifyQuotaFailure reduces to a declarative table, exhausted checked before burst', () => {
  assert.equal(classifyQuotaFailure('HTTP 429 Too Many Requests'), 'burst');
  assert.equal(classifyQuotaFailure('Claude AI usage limit reached|1735689600'), 'exhausted');
  assert.equal(classifyQuotaFailure('429: Claude AI usage limit reached'), 'exhausted');
  assert.equal(classifyQuotaFailure('nothing quota-shaped here'), null);
});

// J8 — detectTamper is a pure decision over a TreeState read exactly once: a self-commit is
// diagnosed as that even alongside a git-directory write, and .git/ is named before either ref
// list, matching the priority order run/iteration.ts used to encode as four separate ifs.
test('detectTamper diagnoses a self-committed HEAD before any other tamper', () => {
  const before: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const after: TreeState = { head: 'bbb', gitDirChanges: ['.git/hooks/pre-commit'], remoteRefChanges: [], otherRefChanges: [] };

  const result = detectTamper(before, after);

  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /committed on its own/);
  assert.doesNotMatch((result as { error: string }).error, /git directory/);
});

test('detectTamper names a git-directory write ahead of a moved ref', () => {
  const before: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const after: TreeState = {
    head: 'aaa',
    gitDirChanges: ['.git/hooks/pre-commit'],
    remoteRefChanges: ['refs/remotes/origin/main'],
    otherRefChanges: [],
  };

  const result = detectTamper(before, after);

  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /changed the git directory: \.git\/hooks\/pre-commit/);
});

test('detectTamper names a pushed remote ref ahead of any other moved ref', () => {
  const before: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const after: TreeState = {
    head: 'aaa',
    gitDirChanges: [],
    remoteRefChanges: ['refs/remotes/origin/main'],
    otherRefChanges: ['refs/heads/side'],
  };

  const result = detectTamper(before, after);

  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /the implementer pushed: refs\/remotes\/origin\/main moved/);
});

test('detectTamper names a moved local ref last', () => {
  const before: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };
  const after: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: ['refs/heads/side'] };

  const result = detectTamper(before, after);

  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /the implementer moved refs\/heads\/side/);
});

test('detectTamper reports nothing when the tree state is unchanged', () => {
  const state: TreeState = { head: 'aaa', gitDirChanges: [], remoteRefChanges: [], otherRefChanges: [] };

  assert.equal(detectTamper(state, state).ok, true);
});

// P3 — every outcome the runner exits with is one constant, read from core/verdict.ts rather
// than redeclared in run/sweep.ts, run/iteration.ts and run/close.ts.
test('the four outcomes are unified in core/verdict.ts, distinct and stable', () => {
  assert.equal(LANDED, 0);
  assert.equal(HALTED, 1);
  assert.equal(REFUSED, 2);
  assert.equal(PAUSED, 3);
});

// P9/J8 — the run/ side re-exports the same values it imports from core/, rather than each
// declaring its own copy that could drift: run/preflight.ts, run/iteration.ts and run/close.ts
// all resolve back to core/verdict.ts's constants.
test('run/preflight.ts, run/iteration.ts and run/close.ts all resolve outcomes back to core/verdict.ts', async () => {
  const [preflight, iteration, close, verdict] = await Promise.all([
    import('../src/run/preflight.ts'),
    import('../src/run/iteration.ts'),
    import('../src/run/close.ts'),
    import('../src/core/verdict.ts'),
  ]);

  assert.equal(preflight.REFUSED, verdict.REFUSED);
  assert.equal(iteration.HALTED, verdict.HALTED);
  assert.equal(iteration.PAUSED, verdict.PAUSED);
  assert.equal(close.LANDED, verdict.LANDED);
  assert.equal(close.HALTED, verdict.HALTED);
});
