import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { installSandboxed } from '../src/install.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);

// R1 (level 1) — installing a skill with the real `skills` CLI copies the whole skill directory
// into the sandbox: every file that exists in the source shows up at the install destination.
test('R1 — install copies every source file into the sandbox destination', async () => {
  const result = await installSandboxed(fixture('valid'), 'valid');

  assert.equal(result.ok, true);
  assert.deepEqual([...result.missingFiles], []);
});

// R11 — the install writes skills-lock.json inside the sandbox project, and it records the
// installed skill by name.
test('R11 — skills-lock.json is written inside the sandbox and names the installed skill', async () => {
  const result = await installSandboxed(fixture('valid'), 'valid');

  assert.equal(result.lockEntryFound, true);
  assert.ok(result.installedDir.startsWith(result.sandboxRoot), 'installed dir stays inside the sandbox');
});

// R11 — the sandbox redirects HOME, CLAUDE_CONFIG_DIR, CODEX_HOME and XDG_CONFIG_HOME so nothing
// the CLI writes lands outside the sandbox; in particular the real $HOME stays untouched.
test('R11 — the real HOME is left untouched by a sandboxed install', async () => {
  const before = existsSync(join(homedir(), '.claude', 'skills', 'valid'));

  await installSandboxed(fixture('valid'), 'valid');

  const after = existsSync(join(homedir(), '.claude', 'skills', 'valid'));
  assert.equal(before, false);
  assert.equal(after, false);
});

// R11 — the sandbox is cleaned up: it is a throwaway cwd, not left behind after install.
test('R11 — the sandbox directory is removed after install completes', async () => {
  const result = await installSandboxed(fixture('valid'), 'valid');

  assert.equal(existsSync(result.sandboxRoot), false);
});
