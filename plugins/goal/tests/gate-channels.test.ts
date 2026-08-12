import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { inProcessGateAdapter, spawnGateAdapter, type GateAdapter } from '../src/adapters/gate.ts';
import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');
const GATE_CMD = `${process.execPath} ${GATE}`;

const GATE_BLOCK = ['test_files=', 'impl_files=a.txt', 'max_diff=50', 'commit_msg=feat: a', 'gate1=true'];

type Slice = { readonly ticked: boolean; readonly lines: readonly string[] };

const planWith = (slices: readonly Slice[]): string =>
  slices
    .flatMap(({ ticked, lines }, index) => [
      `### Iteration ${index + 1} — a slice`,
      `- [${ticked ? 'x' : ' '}] Not done yet`,
      '',
      '```gate',
      ...lines,
      '```',
      '',
    ])
    .join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (slices: readonly Slice[]): { repo: string; plan: string } => {
  const dir = tmpDir('gate-channels-');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'gate@example.com');
  git(dir, 'config', 'user.name', 'Gate');
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  const plan = join(tmpDir('gate-channels-plan-'), 'spec.md');
  writeFileSync(plan, planWith(slices));

  return { repo: dir, plan };
};

// `commit`, `dod` and `scan` read the git tree they are standing in, exactly as `check` and
// `lock`/`unlock` never do: the spawned channel inherits this process's cwd as its own, so the
// in-process channel — which already is this process — is driven from the same place by moving
// here for the length of the call.
const withCwd = <T>(dir: string, run: () => T): T => {
  const before = process.cwd();
  process.chdir(dir);

  try {
    return run();
  } finally {
    process.chdir(before);
  }
};

// P4/J5 — the two channels answer the same observable, verb by verb: in-process, the default this
// suite exists to prove in, and spawn+scrape, the channel a run has always driven.
const CHANNELS: readonly (readonly [string, () => GateAdapter])[] = [
  ['in-process', () => inProcessGateAdapter()],
  ['spawn+scrape', () => spawnGateAdapter(GATE_CMD)],
];

const planHashOf = (adapter: GateAdapter, plan: string, iteration: string): string =>
  /^plan_hash=([0-9a-f]*)$/m.exec(adapter.check(plan, iteration).stdout)![1]!;

test('check answers with the same status, plan_hash and ticked set on both channels', () => {
  const results = CHANNELS.map(([, make]) => {
    const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);

    return withCwd(repo, () => make().check(plan, '1'));
  });

  assert.equal(results[0]!.status, 0, results[0]!.stdout + results[0]!.stderr);
  assert.deepEqual(results[0], results[1]);
});

test('lock then unlock answer identically on both channels', () => {
  const results = CHANNELS.map(([, make]) => {
    const plan = join(tmpDir('gate-channels-lock-'), 'spec.md');
    const adapter = make();

    return { lock: adapter.lock(plan), unlock: adapter.unlock(plan) };
  });

  assert.equal(results[0]!.lock.status, 0, results[0]!.lock.stdout);
  assert.deepEqual(results[0]!.lock, results[1]!.lock);
  assert.deepEqual(results[0]!.unlock, results[1]!.unlock);
});

test('commit lands the same verdict, the same commit and the same tick on both channels', () => {
  const results = CHANNELS.map(([, make]) => {
    const { repo, plan } = fixture([{ ticked: false, lines: GATE_BLOCK }]);
    const adapter = make();
    const hash = withCwd(repo, () => planHashOf(adapter, plan, '1'));

    writeFileSync(join(repo, 'a.txt'), 'a2\n');

    const commit = withCwd(repo, () => adapter.commit(plan, '1', hash, ''));

    return {
      commit,
      subject: git(repo, 'log', '-1', '--pretty=%s').stdout.trim(),
      ticked: readFileSync(plan, 'utf8').includes('- [x]'),
    };
  });

  assert.equal(results[0]!.commit.status, 0, results[0]!.commit.stdout + results[0]!.commit.stderr);
  assert.deepEqual(results[0]!.commit, results[1]!.commit);
  assert.equal(results[0]!.subject, results[1]!.subject);
  assert.equal(results[0]!.ticked, results[1]!.ticked);
});

// R3/R4 — a locked iteration unticked before the commit refuses on both channels, the same way.
test('commit refuses identically on both channels once a locked iteration was unticked', () => {
  const results = CHANNELS.map(([, make]) => {
    const { repo, plan } = fixture([
      { ticked: true, lines: GATE_BLOCK },
      { ticked: false, lines: GATE_BLOCK },
    ]);
    const adapter = make();
    const hash = withCwd(repo, () => planHashOf(adapter, plan, '2'));

    writeFileSync(join(repo, 'a.txt'), 'a2\n');
    writeFileSync(plan, readFileSync(plan, 'utf8').replace('- [x]', '- [ ]'));

    return withCwd(repo, () => adapter.commit(plan, '2', hash, '1'));
  });

  assert.equal(results[0]!.status, 1, results[0]!.stdout + results[0]!.stderr);
  assert.deepEqual(results[0], results[1]);
});

test('dod answers identically on both channels', () => {
  const results = CHANNELS.map(([, make]) => {
    const dir = tmpDir('gate-channels-dod-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'gate@example.com');
    git(dir, 'config', 'user.name', 'Gate');
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');

    const plan = join(tmpDir('gate-channels-dod-plan-'), 'spec.md');
    writeFileSync(plan, '## Definition of Done\n\n```gate\ndod1=true\n```\n');

    return withCwd(dir, () => make().dod(plan));
  });

  assert.equal(results[0]!.status, 0, results[0]!.stdout + results[0]!.stderr);
  assert.deepEqual(results[0], results[1]);
});

// The scanner itself is faked, the way gate-ship.test.ts already proves the verb: a real one's
// own output would carry each fixture's own commit SHAs, which the two channels' separate repos
// never share.
test('scan answers identically on both channels', () => {
  const bin = tmpDir('gate-channels-scanner-');
  writeFileSync(join(bin, 'betterleaks'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

  const path = `${bin}:${resolve(process.execPath, '..')}`;
  const before = process.env.PATH;
  process.env.PATH = path;

  let results: ReturnType<GateAdapter['scan']>[];

  try {
    results = CHANNELS.map(([, make]) => make().scan());
  } finally {
    process.env.PATH = before;
  }

  assert.equal(results[0]!.status, 0, results[0]!.stdout + results[0]!.stderr);
  assert.deepEqual(results[0], results[1]);
});
