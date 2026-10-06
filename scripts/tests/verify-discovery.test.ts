import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const DISCOVERY = resolve(import.meta.dirname, '..', 'verify', 'discovery.ts');

let root = '';
let bin = '';

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'verify-discovery-')));
  bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf \'%s\\n\' "$*" > "$FAKE_ARGV"\nprintf "$FAKE_OUTPUT"\nexit "${FAKE_STATUS:-0}"\n');
  chmodSync(join(bin, 'npx'), 0o755);

  for (const skill of ['one', 'two']) {
    mkdirSync(join(root, 'plugins', 'demo', 'skills', skill), { recursive: true });
    writeFileSync(join(root, 'plugins', 'demo', 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
  }
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

const discover = (output: string, ...args: string[]) =>
  spawnSync(process.execPath, [DISCOVERY, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`, FAKE_OUTPUT: output, FAKE_ARGV: join(root, 'argv') },
  });

test('a discovered count equal to the stock passes, through the colours of a terminal', () => {
  const result = discover('◇  Found \\033[32m2\\033[39m skills\\n');

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, 'skills@1.7.0 discovers 2 skill(s), the stock lists 2\n');
  assert.equal(readFileSync(join(root, 'argv'), 'utf8'), '--yes skills@1.7.0 add . --list\n');
});

test('a skill the CLI does not discover fails the check, naming both counts', () => {
  const result = discover('◇  Found 1 skill\\n');

  assert.equal(result.status, 1);
  assert.equal(result.stdout, 'skills@1.7.0 discovers 1 skill(s), the stock lists 2\n');
});

test('no count in the CLI output fails the check and shows the output', () => {
  const result = discover('No skills found\\n');

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^No skills found\nskills@1\.7\.0 reported no skill count \(exit status 0\)\n$/);
});

test('the canary passes its own CLI spec to npx', () => {
  const result = discover('Found 2 skills\\n', '--cli', 'skills@latest');

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(root, 'argv'), 'utf8'), '--yes skills@latest add . --list\n');
});
