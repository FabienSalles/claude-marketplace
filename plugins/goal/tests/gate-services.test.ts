import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const BITING = 'grep -q "a = 2" src/a.ts';

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const fixture = (gateLines: string[]): { repo: string; plan: string } => {
  const repo = tmpDir('goal-gate-services-');
  git(repo, 'init', '-q');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'src', 'other.txt'), 'one\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.email=g@example.com', '-c', 'user.name=G', 'commit', '-qm', 'init');
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');

  const plan = join(tmpDir('goal-gate-plan-'), 'spec.md');
  const block = [
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts',
    'commit_msg=feat(a): do a thing',
    ...gateLines,
  ];
  writeFileSync(plan, ['### Iteration 1 — A slice', '- [ ] Not done yet', '', '```gate', ...block, '```', ''].join('\n'));

  return { repo, plan };
};

const runGate = (repo: string, plan: string, timeout = '3'): Promise<{ code: number; output: string }> =>
  new Promise((done) => {
    execFile(
      'node',
      [GATE, 'verify', plan, '1'],
      { cwd: repo, encoding: 'utf8', env: { ...process.env, GOAL_CMD_TIMEOUT: timeout } },
      (error, stdout, stderr) => done({ code: error === null ? 0 : Number(error.code ?? -1), output: `${stdout}${stderr}` }),
    );
  });

const alive = (pidFile: string): boolean => {
  try {
    process.kill(Number(readFileSync(pidFile, 'utf8')), 0);

    return true;
  } catch {
    return false;
  }
};

describe('declared services', { concurrency: true }, () => {
  // R6, R7, R12 — services start in order, ready before the first gate, and are gone once the pass ends
  test('declared services start in order, are ready before gate1, and are stopped when the pass ends', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const { repo, plan } = fixture([
      `service1=echo one >> ${state}/order; echo $$ > ${state}/pid1; exec tail -f /dev/null`,
      `service1_ready=test -f ${state}/ready1 || { touch ${state}/ready1; false; }`,
      `service2=echo two >> ${state}/order; echo $$ > ${state}/pid2; touch ${state}/ready2; exec tail -f /dev/null`,
      `service2_ready=test -f ${state}/ready2`,
      `gate1=${BITING} && test -f ${state}/ready1 && test -f ${state}/ready2`,
    ]);

    const { code, output } = await runGate(repo, plan);

    assert.equal(code, 0, output);
    assert.equal(readFileSync(join(state, 'order'), 'utf8').split('\n').slice(0, 2).join(), 'one,two');
    assert.equal(alive(join(state, 'pid1')), false);
    assert.equal(alive(join(state, 'pid2')), false);
  });

  test('a service is stopped when the iteration is refused', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const { repo, plan } = fixture([
      `service1=echo $$ > ${state}/pid1; touch ${state}/ready1; exec tail -f /dev/null`,
      `service1_ready=test -f ${state}/ready1`,
      'gate1=false',
    ]);

    const { code, output } = await runGate(repo, plan);

    assert.equal(code, 1, output);
    assert.equal(alive(join(state, 'pid1')), false);
  });

  // R8 — never ready
  test('a service that never gets ready refuses the iteration with its log, before any gate', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const { repo, plan } = fixture([
      'service1=echo booting-forever; exec tail -f /dev/null',
      'service1_ready=false',
      `gate1=touch ${state}/ran; true`,
    ]);

    const { code, output } = await runGate(repo, plan, '1');

    assert.equal(code, 1, output);
    assert.match(output, /service1/);
    assert.match(output, /never ready/);
    assert.match(output, /booting-forever/);
    assert.equal(existsSync(join(state, 'ran')), false);
  });

  // R8 — died
  test('a service that dies during a gate refuses the iteration, names that gate, and skips the rest', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const { repo, plan } = fixture([
      `service1=echo $$ > ${state}/pid1; touch ${state}/ready1; echo last-words; exec tail -f /dev/null`,
      `service1_ready=test -f ${state}/ready1`,
      `gate1=${BITING}; pid=$(cat ${state}/pid1); kill $pid; while ps -o stat= -p $pid | grep -qv Z; do :; done`,
      `gate2=touch ${state}/ran2`,
    ]);

    const { code, output } = await runGate(repo, plan);

    assert.equal(code, 1, output);
    assert.match(output, /service1/);
    assert.match(output, /died/);
    assert.match(output, /gate1/);
    assert.match(output, /last-words/);
    assert.equal(existsSync(join(state, 'ran2')), false);
  });

  // R9 — restart follows the judged tree
  test('a service restarts when its paths changed, when it has none, and keeps running otherwise', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const start = (name: string): string => `echo x >> ${state}/${name}; rm -f ${state}/${name}.ready; touch ${state}/${name}.ready; exec tail -f /dev/null`;
    const { repo, plan } = fixture(
      [
        `service1=${start('changed')}`,
        `service1_ready=test -f ${state}/changed.ready`,
        'service1_paths=src/a.ts',
        `service2=${start('untouched')}`,
        `service2_ready=test -f ${state}/untouched.ready`,
        'service2_paths=src/other.txt',
        `service3=${start('nopaths')}`,
        `service3_ready=test -f ${state}/nopaths.ready`,
        `gate1=${BITING}`,
        'gate2=echo "// edited" >> src/a.ts',
        `gate3=test $(wc -l < ${state}/changed) = 2 && test $(wc -l < ${state}/untouched) = 1 && test $(wc -l < ${state}/nopaths) = 3`,
      ],
    );

    const { code, output } = await runGate(repo, plan);

    assert.equal(code, 0, output);
  });

  // R10 — a service that cannot start without the implementation proves no bite
  test('a service that cannot start without the implementation is refused as an unproven bite', async () => {
    const state = tmpDir('goal-gate-services-state-');
    const { repo, plan } = fixture([
      `service1=rm -f ${state}/ready1; ${BITING} || exit 1; touch ${state}/ready1; exec tail -f /dev/null`,
      `service1_ready=test -f ${state}/ready1`,
      'service1_paths=src/a.ts',
      `gate1=${BITING}`,
    ]);

    const { code, output } = await runGate(repo, plan);

    assert.equal(code, 1, output);
    assert.match(output, /unproven bite/);
    assert.match(output, /service1/);
    assert.equal(readFileSync(join(repo, 'src', 'a.ts'), 'utf8'), 'export const a = 2;\n');
  });
});
