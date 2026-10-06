import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CERTIFY = join(import.meta.dirname, '..', '..', 'scripts', 'certify.ts');

const fixture = (name: string): string => join(import.meta.dirname, '..', 'fixtures', name);

const emptyTree = (): string => mkdtempSync(join(tmpdir(), 'skills-cli-'));

const copyInto = (root: string, source: string, destination: string): void => {
  cpSync(source, join(root, destination), { recursive: true });
};

const writeInto = (root: string, destination: string, content: string): void => {
  mkdirSync(dirname(join(root, destination)), { recursive: true });
  writeFileSync(join(root, destination), content);
};

const certifyIn = (root: string, args: readonly string[]) =>
  spawnSync(process.execPath, [CERTIFY, ...args], { cwd: root, encoding: 'utf8' });

test('certify --install-all exits 0 when one install delivers every listed skill with its files and its lock entry', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('long-body'), 'plugins/demo/skills/long-body');

    const result = certifyIn(root, ['--install-all', '--cli', 'skills@1.7.0']);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^Sandboxed install of 2 skill\(s\) with skills@1\.7\.0: 0 failure\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --install-all exits 1 and names a listed skill the CLI does not install under its directory name', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    writeInto(root, 'plugins/demo/skills/renamed/SKILL.md', '---\nname: other-name\ndescription: "A skill whose name differs from its directory."\n---\n\n# Renamed\n');

    const result = certifyIn(root, ['--install-all']);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /^\[FAIL\] plugins\/demo\/skills\/renamed install-files-complete: missing SKILL\.md \(source: skills@1\.7\.0\)$/m);
    assert.match(result.stdout, /^\[FAIL\] plugins\/demo\/skills\/renamed install-lock-entry: no entry in skills-lock\.json \(source: skills@1\.7\.0\)$/m);
    assert.doesNotMatch(result.stdout, /plugins\/demo\/skills\/valid /);
    assert.match(result.stdout, /^Sandboxed install of 2 skill\(s\) with skills@1\.7\.0: 2 failure\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
