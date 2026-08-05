import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { jsonlOf, logOf, repo, run, runDirOf, sessionOf } from './support/goal-run-harness.ts';

// Records and contracts stop sharing a directory: a run's own account lives under
// `.claude/goal-runs/<work-id>/<run-id>/`, never beside the plan, so pruning a finished work-id
// is one `rm -rf .claude/goal-runs/<work-id>/`.
test('a run writes .run.log, .run.jsonl and .run.session under .claude/goal-runs/<work-id>/<run-id>/', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_SESSION_ID: 'sess-records',
  });

  assert.equal(code, 0, output);

  const dir = runDirOf(fixture);
  assert.ok(dir.startsWith(join(fixture.dir, '.claude', 'goal-runs', 'demo')), `run directory is not under the work-id: ${dir}`);

  assert.ok(existsSync(logOf(fixture)), 'no .run.log was written in the run directory');
  assert.match(readFileSync(logOf(fixture), 'utf8'), /^STOP /m);

  assert.ok(existsSync(jsonlOf(fixture)), 'no .run.jsonl was written in the run directory');
  assert.match(readFileSync(sessionOf(fixture), 'utf8'), /sess-records/);
});

// `.claude/plans/` — where the plan itself lives — receives nothing from a run anymore.
test('nothing is written beside the plan anymore', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);

  assert.ok(!existsSync(`${fixture.plan}.run.log`), 'the run log was still written beside the plan');
  assert.ok(!existsSync(`${fixture.plan}.run.jsonl`), 'the run jsonl was still written beside the plan');
  assert.ok(!existsSync(`${fixture.plan}.run.session`), 'the run session was still written beside the plan');
});

// A human or `/goal:supervise` finds the run by reading its own stdout: the directory is printed
// once, at launch.
test('the runner prints the run directory at launch', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan, '1'], {
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.match(output, new RegExp(`^RUN .*${join(fixture.dir, '.claude', 'goal-runs', 'demo').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), output);
});

// close() tells the auditor to write its report in the same directory the rest of this run's
// records already live in, not the flat `.claude/goal-runs/<sha>.md` a run used to write.
test('close briefs the auditor to write its report in the run\'s own directory', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-auditor$/m, `the auditor was never invoked:\n${args}`);
  assert.ok(args.includes(join(runDirOf(fixture), 'report.md')), `the auditor was not told to write into the run's own directory:\n${args}`);
});
