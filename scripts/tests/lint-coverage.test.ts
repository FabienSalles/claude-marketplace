import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const BIN = join(ROOT, 'node_modules', '.bin');

let sandbox = '';

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'lint-coverage-')));
  cpSync(join(ROOT, 'plugins', 'goal'), join(sandbox, 'plugins', 'goal'), { recursive: true });
  cpSync(join(ROOT, 'tsconfig.json'), join(sandbox, 'tsconfig.json'));
  cpSync(join(ROOT, 'eslint.config.js'), join(sandbox, 'eslint.config.js'));
  cpSync(join(ROOT, 'package.json'), join(sandbox, 'package.json'));
  symlinkSync(join(ROOT, 'node_modules'), join(sandbox, 'node_modules'));
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const probe = (relative: string, source: string): string => {
  const path = join(sandbox, 'plugins', 'goal', relative);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, source);
  return path;
};

const lint = (path: string) =>
  spawnSync(join(BIN, 'eslint'), ['--config', 'eslint.config.js', path], { cwd: sandbox, encoding: 'utf8' });

const typecheck = () => spawnSync(join(BIN, 'tsc'), ['--noEmit'], { cwd: sandbox, encoding: 'utf8' });

const TRUTHY = {
  string: 'export const f = (s: string): number => (s ? 1 : 0);\n',
  number: 'export const f = (n: number): number => (n ? 1 : 0);\n',
  object: 'export const f = (o: { a: number } | undefined): number => (o ? 1 : 0);\n',
};

test('R1 a type error in a new directory no test imports turns the type-check red', () => {
  probe('tests/never-imported/broken.ts', "export const n: number = 'text';\n");
  const result = typecheck();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /never-imported\/broken\.ts/);
});

test('R1 R2 an implicit truthiness check in a new directory no test imports turns the lint red', () => {
  for (const [kind, source] of Object.entries(TRUTHY)) {
    const result = lint(probe(`tests/never-imported/${kind}.ts`, source));
    assert.notEqual(result.status, 0, kind);
    assert.match(result.stdout, /strict-boolean-expressions/, kind);
  }
});

test('R1 R2 the fixture and every support file are linted too', () => {
  const files = [
    'tests/fixtures/sigint-lock.ts',
    ...readdirSync(join(sandbox, 'plugins', 'goal', 'tests', 'support'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => `tests/support/${name}`),
  ];
  assert.ok(files.length > 1);
  for (const file of files) {
    appendFileSync(join(sandbox, 'plugins', 'goal', file), '\nexport const probeTruthy = (s: string): number => (s ? 1 : 0);\n');
    const result = lint(join(sandbox, 'plugins', 'goal', file));
    assert.match(result.stdout, /strict-boolean-expressions/, file);
  }
});

test('R2 a condition on a boolean passes', () => {
  const result = lint(probe('tests/never-imported/boolean.ts', 'export const f = (b: boolean): number => (b ? 1 : 0);\n'));
  assert.equal(result.status, 0, result.stdout);
});

test('R3 an interface is refused and the same shape as a type passes', () => {
  const refused = lint(probe('tests/never-imported/iface.ts', 'export interface Shape {\n  a: number;\n}\n'));
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /consistent-type-definitions/);
  const accepted = lint(probe('tests/never-imported/alias.ts', 'export type Shape = {\n  a: number;\n};\n'));
  assert.equal(accepted.status, 0, accepted.stdout);
});
