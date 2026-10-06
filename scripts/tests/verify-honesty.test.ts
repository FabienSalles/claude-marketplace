import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { gapsFor, probeRequirement } from '../verify/honesty.ts';
import { CLAUDE_PIN } from '../verify/workflow.ts';

const FIXTURE_ROOT = resolve(import.meta.dirname, 'fixtures', 'verify-root.ts');

const PINNED_NODE = readFileSync(resolve(import.meta.dirname, '..', '..', '.nvmrc'), 'utf8').trim();

const HERMETIC_GIT = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

const ALWAYS = [
  'the ubuntu runner',
  "the canary's latest Claude Code and latest Node 24",
  "the goal suite's wall-clock ceiling, applied on CI only",
];

let repo = '';
let macBash = '';
let newerBash = '';
let newerClaude = '';

const fakeBin = (dir: string, versions: Readonly<Record<string, string>>): string => {
  mkdirSync(dir);

  for (const [program, version] of Object.entries(versions)) {
    writeFileSync(join(dir, program), `#!/bin/sh\nprintf '%s' '${version}'\n`);
    chmodSync(join(dir, program), 0o755);
  }

  return dir;
};

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'verify-honesty-')));
  spawnSync('git', ['init', '-q'], { cwd: repo, env: { ...process.env, ...HERMETIC_GIT } });
  writeFileSync(join(repo, '.gitignore'), '.worktrees/\nnode_modules/\nbin-*/\n');
  macBash = fakeBin(join(repo, 'bin-3.2'), { bash: '3.2.57(1)-release', claude: `${CLAUDE_PIN} (Claude Code)` });
  newerBash = fakeBin(join(repo, 'bin-5.3'), { bash: '5.3.9(1)-release', claude: `${CLAUDE_PIN} (Claude Code)` });
  newerClaude = fakeBin(join(repo, 'bin-claude'), { bash: '3.2.57(1)-release', claude: '2.9.0 (Claude Code)' });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

const run = (env: Record<string, string>, path?: string) =>
  spawnSync(process.execPath, [FIXTURE_ROOT], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...HERMETIC_GIT, GITHUB_ACTIONS: '', FIXTURE_NODE: PINNED_NODE, ...env, ...(path === undefined ? {} : { PATH: path }) },
  });

test('a green local run ends by listing exactly the gaps it cannot reproduce', () => {
  const result = run({ FIXTURE_HONEST: '1' }, `${macBash}:${process.env['PATH'] ?? ''}`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const lines = result.stdout.trimEnd().split('\n');

  assert.deepEqual(lines.slice(-4), [
    'green: every check passed',
    ...ALWAYS.map((gap) => `not reproduced on this Mac: ${gap}`),
  ]);
});

test("a local run under a bash other than 3.2 names the macOS runner's /bin/bash 3.2 as a gap", () => {
  assert.deepEqual(gapsFor({ PATH: newerBash }, PINNED_NODE), [...ALWAYS, "the macOS runner's /bin/bash 3.2 (bash on the PATH: 5.3.9(1)-release)"]);
  assert.deepEqual(gapsFor({ PATH: macBash }, PINNED_NODE), ALWAYS);
});

test('a local claude other than the pinned one names the pinned Claude Code as a gap', () => {
  assert.deepEqual(gapsFor({ PATH: newerClaude }, PINNED_NODE), [...ALWAYS, `Claude Code ${CLAUDE_PIN}, as plugin-validate pins it (claude here: 2.9.0)`]);
  assert.deepEqual(gapsFor({ PATH: join(repo, 'no-such-bin') }, PINNED_NODE), [
    ...ALWAYS,
    `Claude Code ${CLAUDE_PIN}, as plugin-validate pins it (claude here: none)`,
    "the macOS runner's /bin/bash 3.2 (bash on the PATH: none)",
  ]);
});

test('a local Node other than the one .nvmrc pins names the pinned Node as a gap', () => {
  assert.equal(PINNED_NODE, '24.16.0');
  assert.deepEqual(gapsFor({ PATH: macBash }, '24.99.0'), [...ALWAYS, `Node ${PINNED_NODE}, as .nvmrc pins it (this is Node 24.99.0)`]);
});

test('in CI the report lists no gap', () => {
  const result = run({ FIXTURE_HONEST: '1', GITHUB_ACTIONS: 'true' });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /not reproduced on this Mac/);
});

test('with claude off the PATH its check fails naming the claude CLI while the others still report', () => {
  const bin = join(repo, 'bin');
  mkdirSync(bin);
  for (const program of ['node', 'git']) {
    const found = spawnSync('which', [program], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(found, join(bin, program));
  }
  const result = run({ FIXTURE_CLAUDE: '1' }, bin);
  rmSync(bin, { recursive: true, force: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /^failed {2}needs claude {2}/m);
  assert.match(result.stdout, /missing: the claude CLI/);
  assert.match(result.stdout, /^passed {2}one {2}/m);
  assert.match(result.stdout, /^passed {2}three {2}/m);
});

test('an untracked file is named as uncommitted work and a broken skill under an ignored .worktrees changes nothing', () => {
  const broken = join(repo, '.worktrees', 'x', 'skills', 'broken');
  mkdirSync(broken, { recursive: true });
  writeFileSync(join(broken, 'SKILL.md'), '---\nname: [unclosed\n');
  const clean = run({});
  assert.doesNotMatch(clean.stdout, /worktrees/);
  assert.equal(clean.status, 0);

  writeFileSync(join(repo, 'stray.txt'), 'x');
  const dirty = run({});
  assert.equal(dirty.status, 0);
  assert.match(dirty.stdout, /uncommitted work.*stray\.txt/);
  assert.doesNotMatch(dirty.stdout, /worktrees/);
  rmSync(join(repo, 'stray.txt'));
  rmSync(join(repo, '.worktrees'), { recursive: true, force: true });
});

test('uv missing from the PATH is named, so the canary upstream check fails saying why', () => {
  const saved = process.env['PATH'] ?? '';
  process.env['PATH'] = join(repo, 'no-such-bin');

  try {
    assert.equal(probeRequirement('uv'), 'uv (uvx on the PATH)');
  } finally {
    process.env['PATH'] = saved;
  }
});
