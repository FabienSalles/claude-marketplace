import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const DOD = ['dod1=true', 'dod2=true'];

const planWith = (dodLines: readonly string[], heading = '## Definition of Done (global)'): string =>
  [
    'Delivery mode: allow-bc-break',
    '',
    heading,
    '',
    '```gate',
    ...dodLines,
    '```',
    '',
    '## Functional iterations',
    '',
    '### Iteration 1 — A slice',
    '- [ ] Not done yet',
    '',
  ].join('\n');

const planFile = (source: string): string => {
  const plan = join(mkdtempSync(join(tmpdir(), 'goal-gate-ship-')), 'spec.md');
  writeFileSync(plan, source);

  return plan;
};

const runGate = (...args: string[]): { code: number; output: string } => {
  const run = spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const tally = (): string => join(mkdtempSync(join(tmpdir(), 'goal-gate-runs-')), 'runs');

const counted = (path: string): number =>
  existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((line) => line !== '').length : 0;

const withScanners = (installed: readonly { name: string; exit: number }[]): string => {
  const bin = mkdtempSync(join(tmpdir(), 'goal-gate-bin-'));

  for (const { name, exit } of installed) {
    writeFileSync(join(bin, name), `#!/bin/sh\nexit ${exit}\n`, { mode: 0o755 });
  }

  return bin;
};

const runScan = (bin: string): { code: number; output: string } => {
  const run = spawnSync(process.execPath, [GATE, 'scan'], {
    encoding: 'utf8',
    env: { PATH: bin },
  });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

// R15 — the global DoD is replayed once before anything ships
test('a plan whose global Definition of Done passes may ship', () => {
  const { code, output } = runGate('dod', planFile(planWith(DOD)));

  assert.equal(code, 0, output);
});

test('a failing Definition of Done command halts, naming it', () => {
  const { code, output } = runGate('dod', planFile(planWith(['dod1=true', 'dod2=false'])));

  assert.equal(code, 1, output);
  assert.match(output, /dod2/);
});

test('every declared Definition of Done command is replayed exactly once', () => {
  const runs = tally();
  const plan = planFile(planWith([`dod1=echo one >> ${runs}`, `dod2=echo two >> ${runs}`]));

  const { code, output } = runGate('dod', plan);

  assert.equal(code, 0, output);
  assert.equal(counted(runs), 2);
});

test('a plan declaring no Definition of Done cannot ship', () => {
  const { code, output } = runGate('dod', planFile(planWith(DOD, '## Something else')));

  assert.equal(code, 1, output);
  assert.match(output, /Definition of Done/);
});

test('a Definition of Done block declaring no command cannot ship', () => {
  const { code, output } = runGate('dod', planFile(planWith([])));

  assert.equal(code, 1, output);
  assert.match(output, /dod1/);
});

test('a Definition of Done block declaring a key it may not set is refused', () => {
  const { code, output } = runGate('dod', planFile(planWith(['dod1=true', 'gate1=true'])));

  assert.equal(code, 1, output);
  assert.match(output, /gate1/);
});

// R16 — nothing is pushed without a secret scanner having passed
test('betterleaks is the scanner when both are installed', () => {
  const { code, output } = runScan(
    withScanners([
      { name: 'betterleaks', exit: 0 },
      { name: 'gitleaks', exit: 0 },
    ]),
  );

  assert.equal(code, 0, output);
  assert.match(output, /betterleaks/);
});

test('gitleaks is the scanner when betterleaks is not installed', () => {
  const { code, output } = runScan(withScanners([{ name: 'gitleaks', exit: 0 }]));

  assert.equal(code, 0, output);
  assert.match(output, /gitleaks/);
});

test('a scanner that reports a finding refuses the push', () => {
  const { code, output } = runScan(withScanners([{ name: 'betterleaks', exit: 1 }]));

  assert.equal(code, 1, output);
  assert.match(output, /betterleaks/);
});

test('no scanner installed refuses the push, naming what it looked for', () => {
  const { code, output } = runScan(withScanners([]));

  assert.equal(code, 1, output);
  assert.match(output, /betterleaks/);
  assert.match(output, /gitleaks/);
});
