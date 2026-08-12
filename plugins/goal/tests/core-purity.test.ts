import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// P10 — the dependency direction is mechanical, not a convention someone remembers: core/ takes
// values in and hands values back, so it never reaches for the outside world itself (node:fs,
// node:child_process) nor for an adapter that does. gate/ and run/ are the only callers allowed
// to cross that line.

const CORE_DIR = resolve(import.meta.dirname, '..', 'src', 'core');

const FORBIDDEN = [/from ['"]node:fs['"]/, /from ['"]node:child_process['"]/, /from ['"].*adapters\//];

const coreFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    return entry.isDirectory() ? coreFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

test('core/ never imports node:fs, node:child_process, or an adapter', () => {
  for (const file of coreFiles(CORE_DIR)) {
    const source = readFileSync(file, 'utf8');

    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${file} crosses the core/ boundary via ${pattern}`);
    }
  }
});
