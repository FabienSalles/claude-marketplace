import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

type Track = {
  readonly name: string;
  readonly suffix?: string | undefined;
  readonly prepare?: string | undefined;
  readonly iterations: readonly { readonly number: number; readonly impl: string }[];
};

const ASTRO = {
  name: 'astro',
  suffix: 'astro',
  prepare: 'docker compose up -d',
  iterations: [{ number: 1, impl: 'src/a.ts' }],
} satisfies Track;

const PHP = { name: 'php', suffix: 'php', iterations: [{ number: 2, impl: 'src/b.ts' }] } satisfies Track;

const trackPlan = (tracks: readonly Track[]): string =>
  [
    'Delivery mode: allow-bc-break',
    '',
    ...tracks.flatMap((track) => [
      `## Track ${track.name}`,
      '',
      ...(track.suffix === undefined ? [] : [`- **Branch suffix:** ${track.suffix}`]),
      ...(track.prepare === undefined ? [] : [`- **Prepare:** ${track.prepare}`]),
      '',
      ...track.iterations.flatMap((iteration) => [
        `### Iteration ${iteration.number} — A slice of ${track.name}`,
        '- [ ] Not done yet',
        '',
        '```gate',
        'test_files=',
        `impl_files=${iteration.impl}`,
        'max_diff=100',
        `commit_msg=feat(${track.name}): do a thing`,
        'gate1=true',
        '```',
        '',
      ]),
    ]),
  ].join('\n');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const repo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'goal-gate-tracks-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'gate@example.com');
  git(dir, 'config', 'user.name', 'Gate');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  return dir;
};

const planFile = (source: string): string => {
  const plan = join(mkdtempSync(join(tmpdir(), 'goal-gate-plan-')), 'spec.md');
  writeFileSync(plan, source);

  return plan;
};

const runGate = (cwd: string, ...args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { cwd, encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

// R22 — tracks are proven pairwise disjoint before any worktree is created
test('disjoint tracks are listed with their suffix, iterations and preparation', () => {
  const { code, output } = runGate(repo(), 'tracks', planFile(trackPlan([ASTRO, PHP])));

  assert.equal(code, 0, output);
  assert.match(output, /^track\tastro\tastro\t1\tdocker compose up -d/m);
  assert.match(output, /^track\tphp\tphp\t2\t/m);
});

for (const [claim, tracks, said] of [
  [
    'two tracks declare the same file',
    [ASTRO, { ...PHP, iterations: [{ number: 2, impl: 'src/a.ts' }] }],
    /Tracks astro and php are not independent[\s\S]*Shared: src\/a\.ts/,
  ],
  [
    'one track declares a subtree holding another track\'s file',
    [{ ...ASTRO, iterations: [{ number: 1, impl: 'src/' }] }, PHP],
    /Tracks astro and php are not independent[\s\S]*Shared: src\//,
  ],
  ['two tracks share a branch suffix', [ASTRO, { ...PHP, suffix: 'astro' }], /same branch suffix/],
  ['a track declares no branch suffix', [ASTRO, { ...PHP, suffix: undefined }], /declares no branch suffix/],
  [
    'one iteration number belongs to two tracks',
    [ASTRO, { ...PHP, iterations: [{ number: 1, impl: 'src/b.ts' }] }],
    /Iteration 1 is declared by two tracks/,
  ],
] as const) {
  test(`no worktree is created when ${claim}`, () => {
    const { code, output } = runGate(repo(), 'tracks', planFile(trackPlan(tracks)));

    assert.equal(code, 1, output);
    assert.match(output, said);
  });
}

test('a plan declaring no track says so and exits 0', () => {
  const plan = planFile(
    ['Delivery mode: allow-bc-break', '', '### Iteration 1 — A slice', '- [ ] Not done yet', ''].join('\n'),
  );

  const { code, output } = runGate(repo(), 'tracks', plan);

  assert.equal(code, 0, output);
  assert.match(output, /no track/);
});

// R21 — a track's gate runs against that track's own code
test('the gate judges the worktree it stands in, not the tree beside it', () => {
  const main = repo();
  const plan = planFile(
    [
      'Delivery mode: allow-bc-break',
      '',
      '### Iteration 1 — A slice',
      '- [ ] Not done yet',
      '',
      '```gate',
      'test_files=',
      'impl_files=src/a.ts',
      'max_diff=100',
      'commit_msg=feat(a): do a thing',
      'gate1=grep -q "a = 2" src/a.ts',
      '```',
      '',
    ].join('\n'),
  );
  const track = join(main, 'worktree-astro');
  git(main, 'worktree', 'add', '-q', track, '-b', 'feature/astro');
  writeFileSync(join(track, 'src', 'a.ts'), 'export const a = 2;\n');

  const inside = runGate(track, 'verify', plan, '1');
  const beside = runGate(main, 'verify', plan, '1');

  assert.equal(inside.code, 0, inside.output);
  assert.equal(beside.code, 1, beside.output);
});
