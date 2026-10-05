import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, PLAN, git, repo, runInProcess } from './support/goal-run-harness.ts';

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

const unreachable = (fixture: ReturnType<typeof repo>): void => {
  git(fixture.dir, 'remote', 'set-url', 'origin', '/nonexistent/acme/demo.git');
};

test('a refused first push pauses the run after iteration 1 with no second implementer', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  unreachable(fixture);

  const { code, output } = await runInProcess(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, PAUSED, output);
  const lastLine = output.trim().split('\n').pop() ?? '';
  assert.match(lastLine, /^STOP/, output);
  assert.match(lastLine, /push failed/i, output);
  assert.match(lastLine, /local only: 1/, output);
  assert.doesNotMatch(output, /is on the remote|already published/i, output);
  assert.equal(readFileSync(fixture.claudeLog, 'utf8').split('\n').filter((l) => l.includes('goal-run-implementer')).length, 1, output);
});

test('a refused last push pauses after a passing Definition of Done', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  unreachable(fixture);

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /stage=dod/, output);
  assert.match(output, /local only: 1/, output);
  assert.ok(!existsSync(fixture.ghLog) || !/pr\n(create|ready)/.test(readFileSync(fixture.ghLog, 'utf8')), output);
});

test('a closed pull request pauses naming it, and no pull request is created', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await runInProcess(fixture, [fixture.plan, '1'], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GH_PR_EXISTS: '1',
    FAKE_GH_PR_NUMBER: '9',
    FAKE_GH_PR_STATE: 'CLOSED',
  });

  assert.equal(code, PAUSED, output);
  assert.match(output, /#9.*CLOSED/, output);
  assert.ok(!readFileSync(fixture.ghLog, 'utf8').includes('pr\ncreate'), output);
  assert.equal(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, '', output);
});

test('a commit run lands with local commits and no pause', async () => {
  const fixture = repo({ remote: true });
  unreachable(fixture);

  const { code, output } = await runInProcess(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  assert.ok(!existsSync(fixture.ghLog), output);
  assert.match(output.trim().split('\n').pop() ?? '', /local only: 1, 2/, output);
});
