import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HASH, PAUSED, PLAN, git, jsonlOf, repo, run, runDirOf, runInProcess } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';
import { close, LANDED } from '../src/run/close.ts';
import { createPublisher } from '../src/run/publish.ts';
import type { Reporter } from '../src/run/report.ts';

const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');
const PLAN_PR_REVIEW = PLAN_PR.replace('Policy: commit+pr\n', 'Policy: commit+pr\nReview: comment\n');

const land = (fixture: ReturnType<typeof repo>, env: Record<string, string> = {}) =>
  runInProcess(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    ...env,
  });

// The one black-box survivor of this family: everything else in this file drives close() and
// runIteration() in process, through the harness's own pilot; this test alone still spawns the
// real CLI end to end, proving the wiring the pilot stands in for still holds.
// R18 — every declared iteration landed only proves each slice against its own commands; the
// global Definition of Done is the barrier that replays against the whole plan, once, after all
// of them.
test('it replays the global Definition of Done once every requested iteration has landed', () => {
  const fixture = repo();

  const { code, output } = run(fixture, [fixture.plan], {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
  });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.gateLog, 'utf8').split('\n').filter((line) => line !== '');
  assert.equal(calls.filter((line) => line === 'dod').length, 1, `expected exactly one dod call:\n${calls.join('\n')}`);
});

// R18 — a passing Definition of Done is what "shipped" means: the already-open pull request is
// marked ready, mechanically, on the far side of the barrier.
test('a passing Definition of Done marks the open pull request ready', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await land(fixture, { FAKE_GH_PR_EXISTS: '1' });

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /pr\nready/, `the pull request was never marked ready:\n${calls}`);
});

// R18 — a refusing Definition of Done halts the run after every slice landed, and nothing is
// marked ready on top of a plan that is not, as a whole, done.
test('a failing Definition of Done halts the run and skips marking the pull request ready', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await land(fixture, { FAKE_GH_PR_EXISTS: '1', FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0);
  assert.match(output, /Definition of Done/, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.ok(!calls.includes('pr\nready'), `the pull request was marked ready though the Definition of Done refused:\n${calls}`);
});

// R7 — the gate exits 0 for a pass, 1 for a halt, and 2 for a misuse it never got past. Reading
// that last one as a refused Definition of Done reports a verdict the barrier never reached.
test('a Definition of Done that could not be run is not reported as a refusal', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await land(fixture, { FAKE_GATE_DOD_EXIT: '2' });

  assert.equal(code, PAUSED, output);
  assert.match(output, /could not be run/i, output);
  assert.ok(!/refused/i.test(output), `a non-verdict was reported as a refusal:\n${output}`);
});

// R18 — the advisory lens runs after a landed run and never blocks it: its own exit code never
// reaches the run's, since a false alarm cannot undo work the gate already verified and shipped.
test('the advisory lens runs after a landed run and never blocks it', async () => {
  const fixture = repo();

  const { code, output } = await land(fixture, { FAKE_CLAUDE_LENS_EXIT: '1' });

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-lens$/m, `the lens was never invoked:\n${args}`);
});

// R18 — the audit is handed the run's own JSONL path, not a string it can only skim: every stage
// this run timed is an event in that file.
test('the auditor is invoked with the run\'s own JSONL path, not an elapsed string', async () => {
  const fixture = repo();

  const { code, output } = await land(fixture);

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-auditor$/m, `the auditor was never invoked:\n${args}`);
  assert.ok(args.includes(jsonlOf(fixture)), `the auditor was not handed the run's own JSONL path:\n${args}`);
  assert.ok(args.includes(runDirOf(fixture)), `the auditor was not told to write into the run's own directory:\n${args}`);
  assert.ok(!args.includes(fixture.plan), `the plan's absolute path leaked into an agent's argv:\n${args}`);
});

// R1 — close() reads whether publication blocked straight off the state object the publisher
// handed it, never by re-deriving it from the wording of a message: a run where a pull request
// was already found open still skips marking it ready once that state says blocked, regardless
// of what publish() said along the way.
test('close skips marking the pull request ready when the publisher\'s own state says blocked', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const messages: string[] = [];
    const reporter: Reporter = {
      say: (message) => {
        messages.push(message);
      },
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: true } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    assert.ok(!existsSync(fixture.ghLog), `close asked gh to mark the pull request ready though publication had blocked:\n${messages.join('\n')}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R18 — the audit is nobody's optional step: it still runs when the Definition of Done itself
// is what halted the run, so a run that fails to ship is measured too.
test('the auditor still runs when the Definition of Done refuses the run', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code } = await land(fixture, { FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /^goal:goal-run-auditor$/m, `the auditor was never invoked on a halted run:\n${args}`);
});

// R6 / R11 — the lens is briefed from every iteration the plan itself carries ticked, not from
// this run's own `landed`: a plan delivered across several runs is judged whole, in one pass,
// rather than in the fragment the last run happened to land.
test('the lens is briefed from the plan\'s own ticked iterations, not from the run\'s landed list', () => {
  const fixture = repo({
    planText: PLAN.replace('### Iteration 1 — the first one\n- [ ]', '### Iteration 1 — the first one\n- [x]').replace(
      '### Iteration 2 — the second one\n- [ ]',
      '### Iteration 2 — the second one\n- [x]',
    ),
  });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: false, prOpen: false, blocked: false } },
      ['2'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const args = readFileSync(fixture.claudeLog, 'utf8');
    assert.match(args, /Refute the iteration\(s\) 1 2 of/, `the lens was not briefed with the plan's own ticked iterations:\n${args}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R7 — marking the pull request ready is the one moment a review can no longer block anything,
// so that is when the reviewer runs, once, and posts against `gh`.
test('the reviewer runs once the pull request is marked ready', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const args = readFileSync(fixture.claudeLog, 'utf8');
    assert.match(args, /^goal:goal-run-reviewer$/m, `the reviewer was never invoked:\n${args}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R7 — a plan carrying no `Review: comment` header briefs the reviewer to return its review as
// text, never to post it: the log is where the review lands by default.
test('the reviewer is briefed to keep its review in the log when the plan carries no Review header', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const args = readFileSync(fixture.claudeLog, 'utf8');
    assert.match(args, /Do not post it to GitHub/, `the reviewer was not told to withhold posting by default:\n${args}`);
    assert.ok(!args.includes('Post it with `gh`'), `the reviewer was briefed to post though the plan carries no Review header:\n${args}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R7 — a plan carrying `Review: comment` opts into posting, and the brief tells the reviewer to
// open the posted review with a banner naming it as the goal-run-reviewer AI agent's own output.
test('a plan carrying a Review: comment header briefs the reviewer to post with an AI banner', () => {
  const fixture = repo({ planText: PLAN_PR_REVIEW, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const args = readFileSync(fixture.claudeLog, 'utf8');
    assert.match(args, /Post it with `gh`/, `the reviewer was not briefed to post though the plan opts in:\n${args}`);
    assert.match(args, /banner/i, `the reviewer was not briefed to open with a banner:\n${args}`);
    assert.match(args, /goal-run-reviewer/, `the banner instruction never names the goal-run-reviewer agent:\n${args}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R18 — every stage close() runs writes its own timed event, so a run report reads a real cost
// per stage instead of one elapsed figure covering the whole close.
test('close reports a stage=<name> duration_ms=<n> exit=<n> event for every stage it runs', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const messages: string[] = [];
    const reporter: Reporter = {
      say: (message) => {
        messages.push(message);
      },
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const stage = (name: string) =>
      new RegExp(`^RUN stage=${name} duration_ms=\\d+ exit=\\d+$`, 'm');

    for (const name of ['push', 'dod', 'pull-request-update', 'reviewer', 'lens', 'auditor']) {
      assert.match(messages.join('\n'), stage(name), `no stage=${name} event was reported:\n${messages.join('\n')}`);
    }
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// R7 / R11 — a `gh pr ready` that fails leaves publication no further along than before, and the
// reviewer has nothing ready to comment on: it never runs.
test('the reviewer never runs when marking the pull request ready fails', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;
  process.env.FAKE_GH_READY_EXIT = '1';

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const args = readFileSync(fixture.claudeLog, 'utf8');
    assert.ok(!/^goal:goal-run-reviewer$/m.test(args), `the reviewer ran though marking the pull request ready failed:\n${args}`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
    delete process.env.FAKE_GH_READY_EXIT;
  }
});

// R6 — close() reads whether publication blocked straight off the publisher's own state, so the
// reviewer never runs against a pull request that publication never actually reached.
test('the reviewer never runs when the publisher\'s own state says blocked', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: true } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    assert.ok(!existsSync(fixture.ghLog), `close asked gh to mark the pull request ready though publication had blocked:\n`);
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});

// stderr noise loses nothing — an envelope on stdout still yields its stage's token line and
// extracted text intact, the noise recorded separately as diagnostics rather than dropped or
// mixed into the parsed result.
test('an envelope beside stderr noise still yields the token line and text, noise nowhere in the result', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;
  process.env.FAKE_CLAUDE_STDERR_NOISE = 'npm warn deprecated some-noisy-package@1.0.0';

  try {
    const messages: string[] = [];
    const records: string[] = [];
    const reporter: Reporter = {
      say: (message) => {
        messages.push(message);
      },
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: (text) => {
        records.push(text);
      },
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    assert.match(
      messages.join('\n'),
      /^RUN tokens stage=lens input_tokens=10 output_tokens=20 cache_creation_input_tokens=30 cache_read_input_tokens=40 model=claude-sonnet-5 context_tokens=50000 context_pct=25% compactions=0$/m,
      `the lens's token line never survived the stderr noise:\n${messages.join('\n')}`,
    );
    assert.ok(records.includes('fake advisory finding'), `the lens's extracted text never reached record():\n${records.join('\n')}`);
    assert.ok(
      !records.some((text) => text.includes('npm warn deprecated')),
      `stderr noise leaked into the parsed result:\n${records.join('\n')}`,
    );
    assert.ok(
      messages.some((message) => message.includes('npm warn deprecated')),
      `stderr noise was dropped entirely, never recorded as diagnostics:\n${messages.join('\n')}`,
    );
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
    delete process.env.FAKE_CLAUDE_STDERR_NOISE;
  }
});

// one advisory duration — the lens and reviewer run concurrently, so their sleeps overlap in
// time rather than the reviewer only starting once the lens has finished.
test('the lens and reviewer run concurrently rather than one after the other', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  const lensTiming = join(fixture.dir, 'lens.timing');
  const reviewerTiming = join(fixture.dir, 'reviewer.timing');

  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;
  process.env.FAKE_CLAUDE_SLEEPS = '1';
  process.env.FAKE_CLAUDE_LENS_TIMING = lensTiming;
  process.env.FAKE_CLAUDE_REVIEWER_TIMING = reviewerTiming;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const code = close(
      fixture.plan,
      join(fixture.bin, 'fake-gate'),
      HASH,
      'origin',
      { publish: () => {}, state: { publishes: true, prOpen: true, blocked: false } },
      ['1'],
      'run-dir',
      reporter,
    );

    assert.equal(code, LANDED);
    const interval = (path: string) => {
      const [start, end] = readFileSync(path, 'utf8').trim().split(' ').map(Number);
      return { start: start!, end: end! };
    };
    const lens = interval(lensTiming);
    const reviewer = interval(reviewerTiming);

    assert.ok(
      lens.start <= reviewer.end && reviewer.start <= lens.end,
      `expected the lens [${lens.start}, ${lens.end}] and reviewer [${reviewer.start}, ${reviewer.end}] intervals to overlap`,
    );
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
    delete process.env.FAKE_CLAUDE_SLEEPS;
    delete process.env.FAKE_CLAUDE_LENS_TIMING;
    delete process.env.FAKE_CLAUDE_REVIEWER_TIMING;
  }
});

// R5 — the lock is acquired once, before the first iteration, and released only when the process
// exits: two iterations landing in the same run must not show up as two lock/unlock pairs in the
// gate's own log.
test('the lock is acquired once for the whole run, not once per iteration', async () => {
  const fixture = repo();

  const { code, output } = await land(fixture);

  assert.equal(code, 0, output);
  const calls = readFileSync(fixture.gateLog, 'utf8').split('\n').filter((line) => line !== '');
  assert.equal(calls.filter((line) => line === 'lock').length, 1, `expected exactly one lock call across both iterations:\n${calls.join('\n')}`);
  assert.equal(calls.filter((line) => line === 'unlock').length, 1, `expected exactly one unlock call, released once at process exit:\n${calls.join('\n')}`);
});

// R6 — the final iteration's push moves into close(), behind the global Definition of Done: a
// refusal there halts with that last commit landed locally but never reaching the remote, while
// every iteration before it already published as it landed.
test('a Definition of Done refusal leaves the last iteration\'s commit local, never pushed', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await land(fixture, { FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0, output);
  const ahead = git(fixture.dir, 'rev-list', '--count', 'origin/feature/demo..HEAD').stdout.trim();
  assert.equal(ahead, '1', `expected the last iteration's commit to stay unpushed when the Definition of Done refused:\n${output}`);
});

// R6 — the pull request the earlier iterations opened is still there, showing what did land,
// even though the last iteration's own push never went out.
test('a Definition of Done refusal still leaves the draft pull request open from the iterations that already landed', async () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });

  const { code, output } = await land(fixture, { FAKE_GATE_DOD_EXIT: '1' });

  assert.notEqual(code, 0, output);
  const calls = readFileSync(fixture.ghLog, 'utf8');
  assert.match(calls, /pr\ncreate/, `expected a draft pull request opened once the first iteration landed:\n${calls}`);
});

// One report format everywhere — the auditor's brief names the same `### Outcome` /
// `### Cost` skeleton the agent's own prose is written against, so the two cannot diverge
// silently.
test('the auditor is briefed with the ### Outcome / ### Cost skeleton', async () => {
  const fixture = repo();

  const { code, output } = await land(fixture);

  assert.equal(code, 0, output);
  const args = readFileSync(fixture.claudeLog, 'utf8');
  assert.match(args, /### Outcome/, `the audit brief never names the ### Outcome section:\n${args}`);
  assert.match(args, /### Cost/, `the audit brief never names the ### Cost section:\n${args}`);
});

// One report format everywhere — close() folds report.md into the pull request body without
// transformation, and the body ends with the plan path and the run-directory path, one per line,
// so both are copy-pastable straight off the pull request.
test('close folds the report untransformed and ends the pull request body with the plan and run-directory paths', () => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const dir = tmpDir('goal-run-report-footer-');
  const reportText = '# Report\n\n### Outcome\n\nNothing recurs.\n\n### Cost\n\nCosts: 1 iteration.\n';
  writeFileSync(join(dir, 'report.md'), reportText);

  const originalCwd = process.cwd();
  const originalPath = process.env.PATH;
  process.chdir(fixture.dir);
  process.env.PATH = `${fixture.bin}:${originalPath ?? ''}`;

  try {
    const reporter: Reporter = {
      say: () => {},
      stop: () => {
        throw new Error('unexpected stop');
      },
      record: () => {},
      setLog: () => {},
    };

    const publisher = createPublisher(fixture.plan, fixture.plan, 'commit+pr', 'origin', reporter, join(fixture.bin, 'fake-gate'));
    publisher.state.prOpen = true;

    const code = close(fixture.plan, join(fixture.bin, 'fake-gate'), HASH, 'origin', publisher, ['1'], dir, reporter);

    assert.equal(code, LANDED);
    const calls = readFileSync(fixture.ghLog, 'utf8').split('--- call ---\n').filter((call) => call.trim() !== '');
    const edits = calls.filter((call) => call.startsWith('pr\nedit'));
    const last = edits[edits.length - 1]!;

    assert.ok(last.includes(reportText), `the report was transformed before being folded into the pull request body:\n${last}`);
    assert.ok(
      last.trimEnd().endsWith(`*Plan and logs (local, gitignored):*\n- \`${fixture.plan}\`\n- \`${dir}\``),
      `the pull request body does not end with the "Plan and logs" line then one bullet per path:\n${last}`,
    );
  } finally {
    process.chdir(originalCwd);
    process.env.PATH = originalPath;
  }
});
