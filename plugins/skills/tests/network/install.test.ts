import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { installSandboxed } from '../../src/install.ts';

const fixture = (name: string): string => join(import.meta.dirname, '..', 'fixtures', name);

test('R1, R11 — a sandboxed install copies every source file, records the skill in skills-lock.json, writes nothing into the caller HOME and removes its sandbox', async () => {
  const savedEnv = { HOME: process.env['HOME'], npm_config_cache: process.env['npm_config_cache'] };
  const callerHome = mkdtempSync(join(tmpdir(), 'skills-caller-home-'));
  process.env['npm_config_cache'] = savedEnv.npm_config_cache ?? join(homedir(), '.npm');
  process.env['HOME'] = callerHome;

  try {
    const result = await installSandboxed(fixture('valid'), [{ name: 'valid', dir: fixture('valid') }]);

    assert.deepEqual(result.installs, [{ name: 'valid', dir: fixture('valid'), missingFiles: [], lockEntryFound: true }]);
    assert.equal(result.ok, true);
    assert.deepEqual(readdirSync(callerHome), []);
    assert.equal(existsSync(result.sandboxRoot), false);
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    rmSync(callerHome, { recursive: true, force: true });
  }
});
