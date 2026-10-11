import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './support/tmp.ts';
import { repo, run } from './support/goal-run-harness.ts';

process.env.GOAL_LOCK_ROOT = tmpDir('tracked-plan-locks-');

const GATE = resolve(import.meta.dirname, '../scripts/goal-gate.ts');
const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const gate = (cwd: string, plan: string, verb: string, iteration = '1', env: NodeJS.ProcessEnv = process.env) =>
  spawnSync('node', [GATE, verb, plan, iteration], { cwd, env, encoding: 'utf8' });

const fixture = () => {
  const cwd = tmpDir('tracked-plan-');
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'gate@example.com');
  git(cwd, 'config', 'user.name', 'Gate');
  mkdirSync(join(cwd, 'plans'));
  mkdirSync(join(cwd, 'tests'));
  mkdirSync(join(cwd, 'fake-bin'));
  writeFileSync(join(cwd, '.gitignore'), '*.run.lock/\n*.tick.lock/\nfake-bin/\n.goal/runs/\n');
  writeFileSync(join(cwd, 'a.txt'), 'value=1\n');
  writeFileSync(join(cwd, 'tests/a.test.ts'), 'export const proof = true;\n');
  const plan = join(cwd, 'plans', 'contract with spaces.md');
  const source = [
    '# Spec: tracked plan', '', 'Preserve literal .claude/plans/original.md and .claude/goal-runs/old paths.', '',
    ...['1', '2'].flatMap((n) => [
      `### Iteration ${n} — change value`, '- [ ] Not done yet', '', '```gate',
      'test_files=tests/a.test.ts', 'impl_files=a.txt', 'max_diff=50', `commit_msg=feat(value): iteration ${n}`,
      n === '1' ? "gate1=grep -Eq 'value=(2|3)' a.txt" : 'gate1=grep -q value=3 a.txt', '```', '',
    ]),
  ].join('\n');
  writeFileSync(plan, source);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-qm', 'init');

  return { cwd, plan, source };
};

test('two tracked-plan iterations commit their own ticks with code, stay clean and resume with unchanged paths', () => {
  const { cwd, plan, source } = fixture();

  for (const n of ['1', '2']) {
    writeFileSync(join(cwd, 'a.txt'), `value=${Number(n) + 1}\n`);
    const result = gate(cwd, plan, 'commit', n);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(git(cwd, 'show', '--name-only', '--pretty=', 'HEAD').stdout.trim().split('\n'), ['a.txt', 'plans/contract with spaces.md']);
    assert.equal(git(cwd, 'status', '--porcelain').stdout, '');
    const committed = git(cwd, 'show', 'HEAD:plans/contract with spaces.md').stdout;
    assert.equal(readFileSync(plan, 'utf8'), committed);
    assert.equal(committed.replace(/^- \[x\]/gm, '- [ ]'), source);
    assert.equal(existsSync(`${plan}.tick.lock`), false);
    assert.equal(gate(cwd, plan, 'check', n).status, 0);
  }

  const retried = gate(cwd, plan, 'commit', '2');
  assert.equal(retried.status, 1);
  assert.equal(git(cwd, 'log', '-1', '--pretty=%s').stdout.trim(), 'feat(value): iteration 2');
});

for (const mutation of ['prose', 'tick'] as const) {
  test(`an implementer-made ${mutation} edit to a tracked plan is refused even if the plan is declared`, () => {
    const { cwd, plan, source } = fixture();
    const declared = source.replaceAll('impl_files=a.txt', 'impl_files=a.txt plans/');
    writeFileSync(plan, declared);
    git(cwd, 'add', 'plans/');
    git(cwd, 'commit', '-qm', 'declare plan directory');
    writeFileSync(join(cwd, 'a.txt'), 'value=2\n');
    writeFileSync(plan, mutation === 'prose' ? declared.replace('change value', 'rewrite goal') : declared.replace('- [ ]', '- [x]'));

    const result = gate(cwd, plan, 'commit');

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(git(cwd, 'log', '-1', '--pretty=%s').stdout.trim(), 'declare plan directory');
  });
}

for (const failure of ['stage', 'commit'] as const) {
  test(`a ${failure} failure restores the plan and its index entry without erasing implementation`, () => {
    const { cwd, plan, source } = fixture();
    writeFileSync(join(cwd, 'a.txt'), 'value=2\n');
    const before = git(cwd, 'ls-files', '--stage', '--', 'plans/').stdout;
    let env = process.env;

    if (failure === 'stage') {
      const wrapper = join(cwd, 'fake-bin', 'git');
      writeFileSync(wrapper, '#!/bin/sh\ncase "$*" in *"plans/contract with spaces.md"*) if [ "$1" = add ]; then /usr/bin/git "$@"; echo staging-refused >&2; exit 1; fi ;; esac\nexec /usr/bin/git "$@"\n');
      chmodSync(wrapper, 0o755);
      env = { ...process.env, PATH: `${join(cwd, 'fake-bin')}:${process.env.PATH ?? ''}` };
    } else {
      const hook = join(cwd, '.git', 'hooks', 'pre-commit');
      writeFileSync(hook, '#!/bin/sh\ngit show ":plans/contract with spaces.md" > fake-bin/staged-plan\necho commit-refused >&2\nexit 1\n');
      chmodSync(hook, 0o755);
    }

    const result = gate(cwd, plan, 'commit', '1', env);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, failure === 'stage' ? /Staging failed/ : /commit failed/);
    assert.equal(readFileSync(plan, 'utf8'), source);
    assert.equal(git(cwd, 'ls-files', '--stage', '--', 'plans/').stdout, before);
    assert.equal(git(cwd, 'diff', '--cached').stdout, '');
    assert.equal(readFileSync(join(cwd, 'a.txt'), 'utf8'), 'value=2\n');
    assert.equal(git(cwd, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
    assert.equal(existsSync(`${plan}.tick.lock`), false);
    if (failure === 'commit') assert.match(readFileSync(join(cwd, 'fake-bin/staged-plan'), 'utf8'), /^- \[x\]/m);
  });
}

test('tracked-plan run and tick locks remain exclusive and released', () => {
  const { cwd, plan } = fixture();
  assert.equal(gate(cwd, plan, 'lock').status, 0);
  assert.equal(gate(cwd, plan, 'lock').status, 1);
  assert.equal(gate(cwd, plan, 'unlock').status, 0);
  writeFileSync(join(cwd, 'a.txt'), 'value=2\n');
  mkdirSync(`${plan}.tick.lock`);

  const result = gate(cwd, plan, 'commit');

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Another writer/);
  assert.equal(git(cwd, 'log', '-1', '--pretty=%s').stdout.trim(), 'init');
});

test('the runner resumes a tracked plan through the real gate with code and progress already in the same commit', () => {
  const original = fixture();
  const source = original.source.replace('# Spec: tracked plan', '# Spec: demo\n\n---\nPolicy: commit\nRemote: origin\n---') + '\n## Definition of Done\n\n```gate\ndod1=true\n```\n';
  const project = repo({ trackPlan: true, planText: source });
  const binary = join(project.bin, 'claude');
  const script = join(project.bin, 'tracked-implementer');
  writeFileSync(script, '#!/bin/sh\ncase "$*" in\n*goal-run-implementer*) case "$*" in *"Implement iteration 1"*) printf "value=2\\n" > a.txt ;; *) printf "value=3\\n" > a.txt ;; esac ;;\nesac\n');
  chmodSync(script, 0o755);
  const fixtureScript = '#!/bin/sh\nexec sh "' + script + '" "$@"\n';
  unlinkSync(binary);
  writeFileSync(binary, fixtureScript);
  chmodSync(binary, 0o755);
  mkdirSync(join(project.dir, 'tests'));
  writeFileSync(join(project.dir, 'tests/a.test.ts'), 'export const proof = true;\n');
  writeFileSync(join(project.dir, 'a.txt'), 'value=1\n');
  git(project.dir, 'add', 'tests/a.test.ts', 'a.txt');
  git(project.dir, 'commit', '-qm', 'prepare tracked fixture');

  for (const n of ['1', '2']) {
    const result = run(project, [project.plan, n], { GOAL_GATE: undefined });

    assert.equal(result.code, 0, result.output);
    assert.equal(git(project.dir, 'status', '--porcelain').stdout, '');
    assert.equal(git(project.dir, 'show', 'HEAD:plans/demo-spec.md').stdout, readFileSync(project.plan, 'utf8'));
    assert.equal(readFileSync(project.plan, 'utf8').replace(/^- \[x\]/gm, '- [ ]'), source);
  }
});
