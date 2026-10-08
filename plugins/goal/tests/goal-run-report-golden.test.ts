import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { PAUSED, PLAN, repo, runDirOf, runInProcess, type Fixture } from './support/goal-run-harness.ts';

const GOLDEN = join(import.meta.dirname, 'fixtures', 'report-golden.json');
const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

type Capture = {
  code: number;
  lines: string[];
  events: Record<string, unknown>[];
  files: Record<string, string>;
  sessions: string[];
};

type Golden = Record<string, Capture>;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NORMALISED = {
  timestamp: 'the event envelope carries the wall-clock instant it was written',
  duration: 'stage durations and elapsed seconds are measured, not decided',
  run: 'the run directory is named after the instant the run started',
  root: 'every fixture lives under a fresh temporary directory',
} as const;

const normalise = (fixture: Fixture, text: string): string => {
  const roots = [realpathSync(fixture.dir), fixture.dir];
  const temps = [realpathSync(tmpdir()), tmpdir()];
  let out = text.replaceAll(basename(runDirOf(fixture)), '<run-id>');

  for (const [paths, token] of [[roots, '<repo>'], [temps, '<tmp>']] as const) {
    for (const path of paths) {
      out = out.replace(new RegExp(escaped(path), 'g'), token);
    }
  }

  return out.replace(/duration_ms=\d+/g, 'duration_ms=<ms>').replace(/after \d+s/g, 'after <s>s');
};

const filesUnder = (root: string, prefix = ''): string[] =>
  readdirSync(root).flatMap((name) =>
    statSync(join(root, name)).isDirectory() ? filesUnder(join(root, name), `${prefix}${name}/`) : [`${prefix}${name}`],
  );

const capture = async (fixture: Fixture, args: string[], env: Record<string, string>): Promise<Capture> => {
  const { code, output } = await runInProcess(fixture, args, {
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_CLAUDE_WRITE_TAG: 'fixed',
    FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
    GOAL_RUN_QUOTA_SLEEP: '0',
    ...env,
  });
  const dir = runDirOf(fixture);
  const files: Record<string, string> = {};

  for (const name of filesUnder(dir).filter((file) => file !== '.run.jsonl').sort()) {
    files[`run/${name}`] = normalise(fixture, readFileSync(join(dir, name), 'utf8'));
  }

  for (const name of ['a.txt', 'b.txt'].filter((file) => existsSync(join(fixture.dir, file)))) {
    files[name] = readFileSync(join(fixture.dir, name), 'utf8');
  }

  const events = readFileSync(join(dir, '.run.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(normalise(fixture, line.replace(/"ts":"[^"]*"/, '"ts":"<ts>"'))) as Record<string, unknown>);

  return {
    code,
    lines: normalise(fixture, output).split('\n'),
    events,
    files,
    sessions: files['run/.run.session']?.split('\n').filter((line) => line !== '') ?? [],
  };
};

const SCENARIOS: Record<string, () => Promise<Capture>> = {
  success: () => {
    const fixture = repo();

    return capture(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_SESSION_ID: 'session-success' });
  },
  'quota relaunch': () => {
    const fixture = repo();

    return capture(fixture, [fixture.plan, '1'], { FAKE_CLAUDE_SESSION_ID: 'session-quota', FAKE_CLAUDE_QUOTA_UNTIL: '1' });
  },
  'unrecognised pause': () => {
    const fixture = repo();

    return capture(fixture, [fixture.plan, '1'], {
      FAKE_CLAUDE_SESSION_ID: 'session-pause',
      FAKE_CLAUDE_FINAL_ERROR: 'API Error: Unable to connect to API (ECONNRESET)',
      FAKE_CLAUDE_STDERR_NOISE: 'pause stderr',
    });
  },
  'close with lens, reviewer and auditor': () => {
    const fixture = repo({ planText: PLAN_PR, remote: true });

    return capture(fixture, [fixture.plan], {
      FAKE_CLAUDE_SESSION_ID: 'session-close',
      FAKE_CLAUDE_QUOTA_UNTIL: '1',
      FAKE_CLAUDE_STDERR_NOISE: 'close stderr',
      FAKE_GH_PR_EXISTS: '1',
    });
  },
};

const serialised = (golden: Golden): string =>
  JSON.stringify(golden, null, 2).replace(/\{\n\s+"v": 1,[\s\S]*?\n\s+\}/g, (event) => JSON.stringify(JSON.parse(event)));

const record = async (): Promise<Golden> => {
  const golden: Golden = {};

  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    golden[name] = await scenario();
  }

  return golden;
};

const mismatch = (expected: Capture, actual: Capture): string | undefined => {
  try {
    assert.deepEqual(actual, expected);

    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};

const readGolden = (): Golden => {
  assert.ok(existsSync(GOLDEN), 'no report baseline recorded: record it with GOAL_REPORT_GOLDEN_RECORD=1');

  return JSON.parse(readFileSync(GOLDEN, 'utf8')) as Golden;
};

test('the scrubs name their reasons and nothing else is normalised', () => {
  assert.deepEqual(Object.keys(NORMALISED), ['timestamp', 'duration', 'run', 'root']);
});

// R1 — a Claude run writes the same RUN lines, events, artifacts and session history as before the change.
for (const name of Object.keys(SCENARIOS)) {
  test(`the ${name} run matches the report baseline`, async () => {
    const actual = await SCENARIOS[name]!();

    if (process.env.GOAL_REPORT_GOLDEN_RECORD === '1' && name === Object.keys(SCENARIOS)[0]) {
      writeFileSync(GOLDEN, `${serialised(await record())}\n`);
    }

    const expected = readGolden()[name];

    assert.ok(expected !== undefined, `no baseline recorded for ${name}`);
    assert.equal(mismatch(expected, actual), undefined);
  });
}

// R1 — the pins are real: the paused run exits as it did, and the baseline holds the stderr and session history.
test('the baseline pins exit codes, stderr diagnostics and the session sequence with duplicates', () => {
  const golden = readGolden();

  assert.equal(golden['unrecognised pause']!.code, PAUSED);
  assert.ok(golden['close with lens, reviewer and auditor']!.lines.includes('RUN diagnostics stage=lens: close stderr'));
  assert.ok(golden['close with lens, reviewer and auditor']!.lines.includes('RUN diagnostics stage=reviewer: close stderr'));
  assert.ok(golden['close with lens, reviewer and auditor']!.lines.includes('RUN diagnostics stage=auditor: close stderr'));
  assert.ok(golden['quota relaunch']!.sessions.length > 0);
  assert.equal(new Set(golden['close with lens, reviewer and auditor']!.sessions).size, 1);
  assert.ok(golden['close with lens, reviewer and auditor']!.sessions.length > 1);
});

// R1 — one pinned RUN field that moves is caught by the comparison.
test('the comparison fails on a mutated RUN field', () => {
  const expected = readGolden().success!;
  const target = expected.lines.findIndex((line) => line.startsWith('RUN tokens stage=implementer'));
  const mutated = { ...expected, lines: expected.lines.map((line, i) => (i === target ? line.replace('context_pct=25%', 'context_pct=26%') : line)) };

  assert.ok(target >= 0);
  assert.notEqual(mismatch(expected, mutated), undefined);
  assert.equal(mismatch(expected, expected), undefined);
});
