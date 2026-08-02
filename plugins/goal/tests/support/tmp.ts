// Every fixture directory a test creates, removed when the worker that created it exits.
//
// `node --test` isolates each test file in its own process, so one handler per worker reaps exactly
// what that file made. Twenty-one call sites used to mkdtemp and never remove, which cost roughly
// 120 directories per suite run — invisible until a recursion in the suite wrapper ran the suite
// some 200 times and left 114 056 of them in $TMPDIR, on a machine that then stayed pegged through
// a reboot. The cleanup belongs here rather than at each call site: a leak fixed in twenty places
// is a leak that comes back at the twenty-first.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const created: string[] = [];

process.on('exit', () => {
  for (const dir of created) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export const tmpDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));

  created.push(dir);

  return dir;
};
