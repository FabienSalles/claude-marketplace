import { test } from 'node:test';
import assert from 'node:assert/strict';

import { command } from '../src/adapters/command.ts';

// R5 — the real CommandRunner adapter is the one seam production spawns a process through: this
// is the single test that ever lets it touch a real process, everywhere else substitutes it.
test('command.run spawns the named process and reports its exit and output', () => {
  const result = command.run('printf', ['hello']);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'hello');
});

test('command.run reports a non-zero exit for a command that fails', () => {
  const result = command.run('false', []);

  assert.equal(result.status, 1);
});

// R5 — runBinary hands back raw bytes rather than a decoded string, the shape the bite check's
// snapshot of a HEAD blob needs to restore a binary file byte-for-byte.
test('command.runBinary spawns the named process and reports raw stdout bytes', () => {
  const result = command.runBinary('printf', ['hello']);

  assert.ok(Buffer.isBuffer(result.stdout));
  assert.equal(result.stdout.toString('utf8'), 'hello');
});
