import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { execute } from '../verify/execute.ts';
import type { Check, Execute, Probe } from '../verify/ports.ts';
import { modeOf, runVerify } from '../verify/run.ts';

const FIXTURE_ROOT = resolve(import.meta.dirname, 'fixtures', 'verify-root.ts');

const HERMETIC = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo = '';

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-run-')));
  spawnSync('git', ['init', '-q'], { cwd: repo, env: HERMETIC });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

const check = (name: string, group = 'alpha', exclusive = false): Check => ({ name, group, requirements: [], command: [name], exclusive });

type Event = { readonly name: string; readonly at: 'start' | 'end' };

type Run = { readonly status: number; readonly output: string; readonly events: readonly Event[] };

type Options = {
  readonly concurrency: number;
  readonly groups?: readonly string[];
  readonly failing?: readonly string[];
  readonly delays?: Readonly<Record<string, number>>;
  readonly clock?: () => number;
  readonly probe?: Probe;
  readonly abort?: AbortController;
  readonly abortAfter?: string;
};

const verify = async (checks: readonly Check[], options: Options): Promise<Run> => {
  const events: Event[] = [];
  let output = '';
  const execute: Execute = async (target) => {
    events.push({ name: target.name, at: 'start' });
    await delay(options.delays?.[target.name] ?? 5);
    events.push({ name: target.name, at: 'end' });

    if (target.name === options.abortAfter) {
      options.abort?.abort('SIGINT');
    }

    return (options.failing ?? []).includes(target.name)
      ? { status: 'failed', detail: `${target.name} broke` }
      : { status: 'passed', detail: '' };
  };
  const status = await runVerify({
    prepare: check('install', 'install'),
    checks,
    groups: options.groups ?? [],
    concurrency: options.concurrency,
    execute,
    write: (text) => {
      output += text;
    },
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.probe === undefined ? {} : { probe: options.probe }),
    ...(options.abort === undefined ? {} : { abort: options.abort.signal }),
  });

  return { status, output, events };
};

const report = (output: string): readonly string[] =>
  output
    .slice(output.lastIndexOf('\n\n') + 2)
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/ {2}\(\d+\.\d s\)$/, ''));

const mostRunning = (events: readonly Event[]): number => {
  let running = 0;
  let most = 0;

  for (const event of events) {
    running += event.at === 'start' ? 1 : -1;
    most = Math.max(most, running);
  }

  return most;
};

test('parallel and sequential runs give the same verdicts and the same report', async () => {
  const checks = [check('one'), check('two'), check('three', 'beta'), check('suite', 'gamma', true)];
  const parallel = await verify(checks, { concurrency: 4, failing: ['two', 'suite'] });
  const sequential = await verify(checks, { concurrency: 1, failing: ['two', 'suite'] });

  assert.equal(parallel.status, 1);
  assert.equal(sequential.status, 1);
  assert.deepEqual(report(parallel.output), report(sequential.output));
  assert.deepEqual(report(sequential.output), [
    'passed  install',
    'passed  one',
    'failed  two',
    'passed  three',
    'failed  suite',
    'red: 2 check(s) failed',
  ]);
});

test('a parallel run overlaps its checks, a sequential run never does', async () => {
  const checks = [check('one'), check('two'), check('three')];

  assert.ok(mostRunning((await verify(checks, { concurrency: 3 })).events) > 1);
  assert.equal(mostRunning((await verify(checks, { concurrency: 1 })).events), 1);
});

test('exclusive checks run alone, after every other check has ended', async () => {
  const exclusive = ['suite', 'mutation'];
  const checks = [check('suite', 'gamma', true), check('one'), check('mutation', 'delta', true), check('two'), check('three')];
  const { events } = await verify(checks, { concurrency: 4, delays: { one: 20, two: 1, three: 10 } });
  const firstExclusive = events.findIndex((event) => exclusive.includes(event.name));
  const lastOther = events.findLastIndex((event) => !exclusive.includes(event.name));

  assert.ok(firstExclusive > lastOther);

  for (const name of exclusive) {
    const start = events.findIndex((event) => event.name === name && event.at === 'start');

    assert.deepEqual(events[start + 1], { name, at: 'end' });
  }
});

test('every report line carries the duration of its check', async () => {
  let now = 0;
  const clock = (): number => {
    now += 2100;

    return now;
  };
  const { output } = await verify([check('one'), check('two')], { concurrency: 1, clock, failing: ['two'] });

  assert.deepEqual(output.slice(output.lastIndexOf('\n\n') + 2).split('\n').slice(0, 3), [
    'passed  install  (2.1 s)',
    'passed  one  (2.1 s)',
    'failed  two  (2.1 s)',
  ]);
});

test('the report lists the checks in declared order whatever order they finish in', async () => {
  const { output } = await verify([check('one'), check('two'), check('three')], { concurrency: 3, delays: { one: 30, two: 1, three: 10 } });

  assert.deepEqual(report(output), ['passed  install', 'passed  one', 'passed  two', 'passed  three', 'green: every check passed']);
});

test('failure details are printed as each check fails, before the report', async () => {
  const { output } = await verify([check('one'), check('two')], { concurrency: 2, failing: ['one', 'two'], delays: { one: 30, two: 1 } });
  const two = output.indexOf('--- two\ntwo broke\n');
  const one = output.indexOf('--- one\none broke\n');

  assert.ok(two !== -1 && one !== -1);
  assert.ok(two < one);
  assert.ok(one < output.indexOf('\n\npassed  install'));
});

test('an unknown group is refused with status 2, naming it', async () => {
  const { status, output, events } = await verify([check('one')], { concurrency: 1, groups: ['nonsense'] });

  assert.equal(status, 2);
  assert.equal(output, 'unknown group: nonsense\n');
  assert.deepEqual(events, []);
});

test('a missing requirement fails only its own checks, probed once', async () => {
  const probed: string[] = [];
  const needs = (name: string): Check => ({ name, group: 'alpha', requirements: ['claude'], command: [name] });
  const probe: Probe = (requirement) => {
    probed.push(requirement);

    return 'the claude CLI';
  };
  const { output } = await verify([needs('a'), needs('b'), check('c')], { concurrency: 1, probe });

  assert.deepEqual(report(output).slice(1, 4), ['failed  a', 'failed  b', 'passed  c']);
  assert.match(output, /--- a\nmissing: the claude CLI\n/);
  assert.deepEqual(probed, ['claude']);
});

test('--sequential runs one check at a time; by default half the cores, rounded up, run checks', () => {
  assert.deepEqual(modeOf(['--sequential', 'unit'], 18), { groups: ['unit'], concurrency: 1 });
  assert.deepEqual(modeOf(['unit', 'structure'], 18), { groups: ['unit', 'structure'], concurrency: 9 });
  assert.deepEqual(modeOf([], 3), { groups: [], concurrency: 2 });
  assert.deepEqual(modeOf([], 1), { groups: [], concurrency: 1 });
});

test('an interrupt starts no further check and gives no verdict, exiting 128 plus the signal number', async () => {
  const abort = new AbortController();
  const { status, output, events } = await verify([check('one'), check('two'), check('three')], { concurrency: 1, abort, abortAfter: 'one' });

  assert.equal(status, 130);
  assert.deepEqual(
    events.filter((event) => event.at === 'start').map((event) => event.name),
    ['install', 'one'],
  );
  assert.equal(output.trimEnd().split('\n').at(-1), 'interrupted by SIGINT: 2 check(s) not run, no verdict');
  assert.doesNotMatch(output, /^(green|red):/m);
});

test('a failed install runs no check: the selected checks are reported as not run, with the install as the cause', async () => {
  const { status, output, events } = await verify([check('one'), check('two'), check('suite', 'gamma', true)], { concurrency: 2, failing: ['install'] });

  assert.equal(status, 1);
  assert.deepEqual(events.map((event) => event.name), ['install', 'install']);
  assert.match(output, /^--- install\ninstall broke\n/);
  assert.deepEqual(report(output), ['failed  install', 'red: install failed: 3 check(s) not run']);
});

const real = async (checks: readonly Check[]): Promise<{ readonly status: number; readonly output: string }> => {
  let output = '';
  const status = await runVerify({
    prepare: { name: 'install', group: 'install', requirements: [], command: ['true'] },
    checks,
    groups: [],
    concurrency: 2,
    execute: (target, abort) => execute(target, repo, abort),
    write: (text) => {
      output += text;
    },
  });

  return { status, output };
};

const running = (pid: number): boolean => {
  const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim();

  return state !== '' && !state.startsWith('Z');
};

test('a background process a passing check leaves behind is gone before an exclusive check starts', async () => {
  const pidFile = join(repo, 'straggler.pid');
  const straggler = (): number => Number(readFileSync(pidFile, 'utf8'));
  const checks: readonly Check[] = [
    { name: 'leaves a straggler', group: 'alpha', requirements: [], command: ['bash', '-c', `sleep 300 >/dev/null 2>&1 & echo $! > "${pidFile}"`] },
    { name: 'runs alone', group: 'alpha', requirements: [], exclusive: true, inline: () => (running(straggler()) ? ['the straggler still runs'] : []) },
  ];

  try {
    const { status, output } = await real(checks);

    assert.equal(status, 0, output);
  } finally {
    if (existsSync(pidFile) && running(straggler())) {
      process.kill(straggler(), 'SIGKILL');
    }

    rmSync(pidFile, { force: true });
  }
});

test('a check whose execution throws is reported failed with the error, and every other check still reports', async () => {
  const checks: readonly Check[] = [
    { name: 'one', group: 'alpha', requirements: [], command: ['true'] },
    { name: 'two', group: 'alpha', requirements: [], command: ['echo', 'a\u0000b'] },
    { name: 'three', group: 'alpha', requirements: [], command: ['true'] },
  ];
  const { status, output } = await real(checks);

  assert.equal(status, 1);
  assert.match(output, /^--- two\nthrew: .*null bytes/m);
  assert.deepEqual(report(output), ['passed  install', 'passed  one', 'failed  two', 'passed  three', 'red: 1 check(s) failed']);
});

const run = (broken: string, ...args: string[]) =>
  spawnSync(process.execPath, [FIXTURE_ROOT, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...HERMETIC, FIXTURE_BROKEN: broken },
  });

test('nothing broken: every check passed and the exit status is zero', () => {
  const result = run('');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^passed {2}one {2}\(\d+\.\d s\)$/m);
  assert.match(result.stdout, /^passed {2}two {2}/m);
  assert.match(result.stdout, /^passed {2}three {2}/m);
});

test('two checks broken at once give two failed lines in one run and a non-zero exit', () => {
  const result = run('one,three');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^failed {2}one {2}/m);
  assert.match(result.stdout, /^failed {2}three {2}/m);
  assert.match(result.stdout, /^passed {2}two {2}/m);
});

test('a failing check shows its output and why it failed', () => {
  assert.match(run('two').stdout, /--- two\nboom\nexit status 1\n/);
});

test('--sequential through the command gives the report of the default mode', () => {
  const parallel = run('two');
  const sequential = run('two', '--sequential');

  assert.equal(sequential.status, parallel.status);
  assert.deepEqual(report(sequential.stdout), report(parallel.stdout));
});

test('a named group runs only its checks', () => {
  const result = run('', 'beta');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^passed {2}three {2}/m);
  assert.doesNotMatch(result.stdout, /^\w+ {2}(one|two) {2}/m);
});

test('dependencies are installed before judging', () => {
  rmSync(join(repo, 'node_modules'), { recursive: true, force: true });
  const result = run('');
  assert.equal(result.status, 0);
  assert.ok(existsSync(join(repo, 'node_modules', '.installed')));
});
