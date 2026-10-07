import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { PLAN, launchesOf, repo, runInProcess, runDirOf, type LaunchRecord } from './support/goal-run-harness.ts';
import { spawnSync } from 'node:child_process';

const GOLDEN = join(import.meta.dirname, 'fixtures', 'launch-golden.jsonl');
const PLAN_PR = PLAN.replace('Policy: commit\n', 'Policy: commit+pr\n');

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const agentOf = (record: LaunchRecord) => record.argv[record.argv.indexOf('--agent') + 1] ?? '';

const inheritedCeiling = () => spawnSync('/bin/sh', ['-c', 'ulimit -u'], { encoding: 'utf8' }).stdout.trim();

const ceilingOf = (record: LaunchRecord, inherited: string): string => {
  if (agentOf(record) !== 'goal:goal-run-implementer') {
    return record.ulimit === inherited ? 'inherited' : record.ulimit;
  }

  const bounded = inherited === 'unlimited' || Number(record.ulimit) <= Number(inherited);

  return bounded ? '<ceiling>' : record.ulimit;
};

const launchLines = async (): Promise<string[]> => {
  const fixture = repo({ planText: PLAN_PR, remote: true });
  const launchLog = join(fixture.dir, 'launch.jsonl');
  const env: Record<string, string | undefined> = {
    DISABLE_AUTOUPDATER: undefined,
    FAKE_GATE_COMMITS: '1',
    FAKE_CLAUDE_WRITES: join(fixture.dir, 'a.txt'),
    FAKE_GH_PR_EXISTS: '1',
    FAKE_CLAUDE_LAUNCH_LOG: launchLog,
  };
  const baseline = { ...process.env, PATH: `${fixture.bin}:${process.env.PATH ?? ''}`, ...env };

  const { code, output } = await runInProcess(fixture, [fixture.plan], env);

  assert.equal(code, 0, output);

  const inherited = inheritedCeiling();
  const roots = [realpathSync(fixture.dir), fixture.dir];
  const temps = [realpathSync(tmpdir()), tmpdir()];
  const runDirs = [realpathSync(runDirOf(fixture)), runDirOf(fixture)];

  const normalise = (text: string) => {
    let out = text.replace(new RegExp(escaped(relative(fixture.dir, runDirOf(fixture))), 'g'), '<run-dir>');

    for (const [paths, token] of [[runDirs, '<run-dir>'], [roots, '<repo>'], [temps, '<tmp>']] as const) {
      for (const path of paths) {
        out = out.replace(new RegExp(escaped(path), 'g'), token);
      }
    }

    return out.replace(/feature\/demo/g, '<branch>');
  };

  return launchesOf(launchLog, baseline)
    .sort((a, b) => agentOf(a).localeCompare(agentOf(b)))
    .map((record) => ({ ...record, ulimit: ceilingOf(record, inherited) }))
    .map((record) => normalise(JSON.stringify(record)));
};

const lineDiff = (expected: string[], actual: string[]): string => {
  const lines: string[] = [];

  for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
    if (expected[i] !== actual[i]) {
      lines.push(`line ${i + 1}\n- ${expected[i] ?? '(none)'}\n+ ${actual[i] ?? '(none)'}`);
    }
  }

  return lines.join('\n');
};

const mismatch = (expected: string[], actual: string[]): string | undefined => {
  const diff = lineDiff(expected, actual);

  return diff === '' ? undefined : diff;
};

// R1 — the binary, every flag in order, the envelope's process ceiling, the environment the
// runner adds and the exact brief of the four sessions are frozen on a fixed plan.
test('the launch of the implementer, lens, reviewer and auditor sessions matches the golden', async () => {
  const actual = await launchLines();

  if (process.env.GOAL_GOLDEN_UPDATE === '1') {
    writeFileSync(GOLDEN, `${actual.join('\n')}\n`);
  }

  assert.ok(existsSync(GOLDEN), 'no golden recorded: regenerate with GOAL_GOLDEN_UPDATE=1');
  assert.deepEqual(
    actual.map((line) => (JSON.parse(line) as LaunchRecord).argv[2]),
    ['goal:goal-run-auditor', 'goal:goal-run-implementer', 'goal:goal-run-implementer', 'goal:goal-run-lens', 'goal:goal-run-reviewer'],
  );

  const expected = readFileSync(GOLDEN, 'utf8').split('\n').filter((line) => line !== '');

  assert.equal(mismatch(expected, actual), undefined);
});

// R1 — a flag, an env value or one brief character that moves is caught by the comparison.
test('the comparison fails on a mutated flag, env value or brief character', () => {
  const expected = readFileSync(GOLDEN, 'utf8').split('\n').filter((line) => line !== '');
  const target = expected.findIndex((line) => line.includes('"goal:goal-run-implementer"'));
  const mutate = (from: string, to: string) => expected.map((line, i) => (i === target ? line.replace(from, to) : line));

  assert.ok(expected[target]!.includes('"--verbose"'));
  assert.ok(expected[target]!.includes('"DISABLE_AUTOUPDATER":"1"'));
  assert.notEqual(mismatch(expected, mutate('"--verbose"', '"--quiet"')), undefined);
  assert.notEqual(mismatch(expected, mutate('"DISABLE_AUTOUPDATER":"1"', '"DISABLE_AUTOUPDATER":"0"')), undefined);
  assert.notEqual(mismatch(expected, mutate('iteration', 'iteratioN')), undefined);
  assert.equal(mismatch(expected, expected), undefined);
});
