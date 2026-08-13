// Support for gate-captures.test.ts: drives the real goal-gate.ts and plan-guard.ts — never a
// stand-in — inside a from-scratch fixture, so a captured reference pins genuine output rather
// than a fake's.
//
// The harness is frozen on purpose: LC_ALL=C and both git config layers neutralized so a
// developer's own identity or aliases never leak into a captured line, no GOAL_RUN_JSONL
// inherited from an outer run, and a fake scanner placed first on PATH that records its own
// argv — unlike gate-ship.test.ts's blind `#!/bin/sh\nexit 0`, this one is what lets a capture
// notice the scanner invocation's own scope (`git` vs `dir`) move.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { tmpDir } from './tmp.ts';

export const GATE = resolve(import.meta.dirname, '..', '..', 'scripts', 'goal-gate.ts');
export const GUARD = resolve(import.meta.dirname, '..', '..', 'src', 'plan-guard.ts');
export const CAPTURES = resolve(import.meta.dirname, '..', 'captures');

const git = (cwd: string, ...args: string[]): void => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });

  if (run.status !== 0) {
    throw new Error(`fixture setup: git ${args.join(' ')} failed:\n${run.stdout}${run.stderr}`);
  }
};

// The one plan every scenario reads from — a single iteration, a global Definition of Done, and
// a gate1 that only holds with a.txt on disk (`test -f a.txt`), so the same fixture serves
// verify's happy path and bite's "fails without the implementation" halt alike.
export const PLAN = `# Spec: capture fixture

---
Policy: commit
Remote: origin
---

## Definition of Done (global)

\`\`\`gate
dod1=true
\`\`\`

## Functional iterations

### Iteration 1 — the captured slice
- [ ] Not done yet

\`\`\`gate
test_files=t.txt
impl_files=a.txt
max_diff=50
commit_msg=feat: a
gate1=test -f a.txt
\`\`\`
`;

export type Fixture = { dir: string; bin: string; scannerArgv: string; plan: string };

// A fresh repository per scenario: `commit` ticks the box and commits for real, so a scenario
// sharing a fixture with another would read a tree a previous capture already moved on.
export const fixture = (): Fixture => {
  const dir = tmpDir('gate-capture-');
  const bin = join(dir, 'fake-bin');
  const scannerArgv = join(dir, 'scanner-argv.txt');

  mkdirSync(bin);

  // Both names are faked, not only the one a scenario means to exercise: `secretScan` prefers
  // betterleaks over gitleaks, so a real betterleaks already on a developer's own PATH would
  // otherwise win over this fixture's fake and make the capture depend on whichever scanners
  // happen to be installed on the machine running the suite.
  for (const name of ['betterleaks', 'gitleaks']) {
    writeFileSync(join(bin, name), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${scannerArgv}\nexit 0\n`, { mode: 0o755 });
  }

  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'capture@example.com');
  git(dir, 'config', 'user.name', 'Capture');
  writeFileSync(join(dir, '.gitignore'), 'fake-bin/\nscanner-argv.txt\n');
  writeFileSync(join(dir, 'spec.md'), PLAN);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  return { dir, bin, scannerArgv, plan: 'spec.md' };
};

// Writes a.txt and t.txt as uncommitted, staged changes — the shape the implementer leaves the
// tree in before the gate ever runs — so scopeCheck, the bounds and the bite check all see the
// same "iteration in progress" tree the real runner hands off to.
export const stageImplementation = (fx: Fixture): void => {
  writeFileSync(join(fx.dir, 'a.txt'), 'a\n');
  writeFileSync(join(fx.dir, 't.txt'), 't\n');
  git(fx.dir, 'add', 'a.txt', 't.txt');
};

const run = (fx: Fixture, script: string, args: string[]): { code: number; output: string } => {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: fx.dir,
    encoding: 'utf8',
    env: {
      PATH: `${fx.bin}:${process.env.PATH ?? ''}`,
      LC_ALL: 'C',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GOAL_RUN_JSONL: undefined,
    },
  });

  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
};

export const runGate = (fx: Fixture, ...args: string[]): { code: number; output: string } => run(fx, GATE, args);

export const runGuard = (fx: Fixture, ...args: string[]): { code: number; output: string } => run(fx, GUARD, args);

export const captured = (name: string): string => readFileSync(join(CAPTURES, `${name}.txt`), 'utf8');

export const scannerArgv = (fx: Fixture): string => readFileSync(fx.scannerArgv, 'utf8');

// `bite`, `verify` and `commit` all print a `BACKUP: ... /tmp/...` line ahead of their `OK:`
// line(s) — the one part of their output a tmp-dir path keeps out of a captured reference. The
// `OK:` lines alone are what R1 pins; the backup path is bite.ts's own concern, not this net's.
export const okLines = (output: string): string =>
  output
    .split('\n')
    .filter((line) => line.startsWith('OK:'))
    .map((line) => `${line}\n`)
    .join('');
