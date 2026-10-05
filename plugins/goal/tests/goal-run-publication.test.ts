import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAUSED, PLAN, REFUSED, git, repo, runInProcess } from './support/goal-run-harness.ts';

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

const THREE = `# Spec: demo

---
Policy: commit+pr
Remote: origin
---

${[1, 2, 3]
  .map(
    (n) => `### Iteration ${n} — number ${n}
- [ ] Not done yet
- **Goal:** goal ${n}

\`\`\`gate
test_files=t.txt
impl_files=f${n}.txt
max_diff=50
commit_msg=feat: number ${n}
gate1=true
\`\`\`
`,
  )
  .join('\n')}`;

const implementers = (fixture: ReturnType<typeof repo>): number =>
  existsSync(fixture.claudeLog) ? readFileSync(fixture.claudeLog, 'utf8').split('\n').filter((l) => l.includes('goal-run-implementer')).length : 0;

const tick = (fixture: ReturnType<typeof repo>, n: number): void => {
  const text = readFileSync(fixture.plan, 'utf8');
  const at = text.indexOf(`### Iteration ${n} `);
  writeFileSync(fixture.plan, text.slice(0, at) + text.slice(at).replace('- [ ] Not done yet', '- [x] Not done yet'));
};

const launch = (fixture: ReturnType<typeof repo>, args: string[]) =>
  runInProcess(fixture, args, {
    FAKE_GATE_COMMITS: '1',
    FAKE_GATE_COMMIT_FROM_PLAN: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

test('a relaunch with the remote reachable publishes before the next implementer, and each iteration is implemented and committed once', async () => {
  const fixture = repo({ planText: THREE, remote: true });
  const origin = git(fixture.dir, 'remote', 'get-url', 'origin').stdout.trim();
  unreachable(fixture);

  const first = await launch(fixture, [fixture.plan]);
  assert.equal(first.code, PAUSED, first.output);
  assert.equal(implementers(fixture), 1, first.output);

  tick(fixture, 1);
  git(fixture.dir, 'remote', 'set-url', 'origin', origin);

  const second = await launch(fixture, [fixture.plan]);
  assert.equal(second.code, 0, second.output);
  assert.ok(second.output.indexOf('opened a draft pull request') < second.output.indexOf('RUN iteration 2 of'), second.output);
  assert.equal(implementers(fixture), 3, second.output);

  const subjects = git(fixture.dir, 'log', '--format=%s').stdout.split('\n');

  for (const n of [1, 2, 3]) {
    assert.equal(subjects.filter((s) => s === `feat: number ${n}`).length, 1, subjects.join('\n'));
  }

  const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n');
  const body = calls.filter((call) => call.startsWith('pr\nedit')).pop() ?? '';
  assert.match(body, /1\. goal 1 [0-9a-f]{7}\n2\. goal 2 [0-9a-f]{7}\n3\. goal 3 [0-9a-f]{7}/, body);
  assert.match(git(fixture.dir, 'ls-remote', '--heads', 'origin').stdout, /feature\/demo/);
});

test('a relaunch with the remote still unreachable pauses again and launches no implementer', async () => {
  const fixture = repo({ planText: THREE, remote: true });
  unreachable(fixture);

  const first = await launch(fixture, [fixture.plan]);
  assert.equal(first.code, PAUSED, first.output);

  tick(fixture, 1);

  const second = await launch(fixture, [fixture.plan]);
  assert.equal(second.code, PAUSED, second.output);
  assert.match(second.output.trim().split('\n').pop() ?? '', /push failed.*local only: 1/i, second.output);
  assert.equal(implementers(fixture), 1, second.output);
  assert.equal(git(fixture.dir, 'status', '--porcelain').stdout, '', second.output);
});

test('a named iteration that is already ticked is refused before anything happens', async () => {
  const fixture = repo({ planText: THREE, remote: true });
  tick(fixture, 1);

  const { code, output } = await launch(fixture, [fixture.plan, '1']);

  assert.equal(code, REFUSED, output);
  assert.match(output, /already ticked/, output);
  assert.equal(implementers(fixture), 0, output);
  assert.ok(!existsSync(fixture.ghLog), output);
});
