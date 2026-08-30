import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// P10 — the dependency direction is mechanical, not a convention someone remembers: core/ takes
// values in and hands values back, so it never reaches for the outside world itself nor for an
// adapter that does. gate/ and run/ are the only callers allowed to cross that line. The rule is
// stated once, as "what an import specifier is allowed to be", rather than as a list of the three
// spellings (node:fs, node:child_process, adapters/) someone happened to observe crossing it.

const CORE_DIR = resolve(import.meta.dirname, '..', 'src', 'core');

// node:path is a pure string transform on a value already in hand: no filesystem, no process,
// no I/O. It is the one node: builtin the dependency rule lets core/ keep.
const ALLOWED_NODE_BUILTINS = new Set(['node:path']);

const IMPORT_SPECIFIER = /(?:import|export)\s[^;]*?\sfrom\s+['"]([^'"]+)['"]/g;

const coreFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    return entry.isDirectory() ? coreFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

const isAllowed = (specifier: string, fromFile: string): boolean => {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier).startsWith(CORE_DIR);
  if (specifier.startsWith('node:')) return ALLOWED_NODE_BUILTINS.has(specifier);

  return false;
};

test('core/ has files to guard', () => {
  assert.notEqual(coreFiles(CORE_DIR).length, 0, `${CORE_DIR} is empty — the guard below would vacuously pass`);
});

test('core/ imports only itself and the node: builtins the dependency rule allows', () => {
  for (const file of coreFiles(CORE_DIR)) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1]!;

      assert.ok(isAllowed(specifier, file), `${file} crosses the core/ boundary by importing "${specifier}"`);
    }
  }
});
