import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { ESLint } from 'eslint';

import { DECLARED_EXCLUSION, workTree } from '../verify/coverage.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');
const BIN = join(ROOT, 'node_modules', '.bin');
const PROBES = join('plugins', 'lint-probe', 'never-imported');

const SOURCES: Readonly<Record<string, string>> = {
  'string.ts': 'export const f = (s: string): number => (s ? 1 : 0);\n',
  'number.ts': 'export const f = (n: number): number => (n ? 1 : 0);\n',
  'object.ts': 'export const f = (o: { a: number } | undefined): number => (o ? 1 : 0);\n',
  'boolean.ts': 'export const f = (b: boolean): number => (b ? 1 : 0);\n',
  'iface.ts': 'export interface Shape {\n  a: number;\n}\n',
  'alias.ts': 'export type Shape = {\n  a: number;\n};\n',
  'broken.ts': "export const n: number = 'text';\n",
};

let sandbox = '';
let typecheck: ReturnType<typeof spawnSync> | undefined;
let rules: Readonly<Record<string, readonly (string | null)[]>> = {};

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'lint-coverage-')));

  for (const file of ['tsconfig.json', 'eslint.config.js', 'package.json']) {
    cpSync(join(ROOT, file), join(sandbox, file));
  }

  symlinkSync(join(ROOT, 'node_modules'), join(sandbox, 'node_modules'));
  mkdirSync(join(sandbox, PROBES), { recursive: true });

  for (const [name, source] of Object.entries(SOURCES)) {
    writeFileSync(join(sandbox, PROBES, name), source);
  }

  typecheck = spawnSync(join(BIN, 'tsc'), ['--noEmit'], { cwd: sandbox, encoding: 'utf8' });

  const lint = spawnSync(join(BIN, 'eslint'), ['--config', 'eslint.config.js', '--format', 'json', PROBES], { cwd: sandbox, encoding: 'utf8' });
  const results = JSON.parse(lint.stdout) as readonly { readonly filePath: string; readonly messages: readonly { readonly ruleId: string | null }[] }[];

  rules = Object.fromEntries(results.map((result) => [relative(join(sandbox, PROBES), result.filePath), result.messages.map((message) => message.ruleId)]));
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

test('R1 a type error in a new directory no test imports turns the type-check red, naming only that file', () => {
  assert.notEqual(typecheck?.status, 0);
  assert.match(String(typecheck?.stdout), /never-imported\/broken\.ts/);
  assert.doesNotMatch(String(typecheck?.stdout), /never-imported\/(?!broken\.ts)/);
});

test('R1 R2 an implicit truthiness check on a string, a number or an object is refused in a directory no test imports', () => {
  for (const kind of ['string.ts', 'number.ts', 'object.ts']) {
    assert.deepEqual(rules[kind], ['@typescript-eslint/strict-boolean-expressions'], kind);
  }
});

test('R2 a condition on a boolean is linted and passes', () => {
  assert.deepEqual(rules['boolean.ts'], []);
});

test('R3 an interface is refused and the same shape as a type is linted and passes', () => {
  assert.deepEqual(rules['iface.ts'], ['@typescript-eslint/consistent-type-definitions']);
  assert.deepEqual(rules['alias.ts'], []);
});

test('every TypeScript file of the work tree but the declared exclusion is linted with both rules at their strict setting', async () => {
  const files = workTree(ROOT).filter((file) => file.endsWith('.ts') && file !== DECLARED_EXCLUSION);
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: join(ROOT, 'eslint.config.js') });

  assert.ok(files.length > 0);

  for (const file of files) {
    const config = (await eslint.calculateConfigForFile(join(ROOT, file))) as { readonly rules?: Readonly<Record<string, unknown>> } | undefined;

    assert.deepEqual(
      config?.rules?.['@typescript-eslint/strict-boolean-expressions'],
      [2, { allowString: false, allowNumber: false, allowNullableObject: false }],
      file,
    );
    assert.deepEqual(config?.rules?.['@typescript-eslint/consistent-type-definitions'], [2, 'type'], file);
  }
});
