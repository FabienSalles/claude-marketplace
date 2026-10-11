import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { tmpDir } from './support/tmp.ts';

const SHIM = resolve(import.meta.dirname, '..', 'src', 'adapters', 'copilot', 'gh.sh');

const gh = (args: string[], review?: string): { code: number; stderr: string; real: string } => {
  const dir = tmpDir('copilot-gh-');
  const shim = join(dir, 'shim');
  const real = join(dir, 'real');

  mkdirSync(shim);
  mkdirSync(real);
  symlinkSync(SHIM, join(shim, 'gh'));
  writeFileSync(join(real, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$@" >> "${dir}/real-args.txt"\n`);
  chmodSync(join(real, 'gh'), 0o755);

  const result = spawnSync(join(shim, 'gh'), args, {
    encoding: 'utf8',
    env: { PATH: `${shim}:${real}:/usr/bin:/bin`, ...(review === undefined ? {} : { GOAL_RUN_REVIEW: review }) },
  });
  const log = join(dir, 'real-args.txt');

  return { code: result.status ?? -1, stderr: result.stderr, real: existsSync(log) ? readFileSync(log, 'utf8') : '' };
};

// R12 — the reviewer reads a pull request whatever the plan says.
test('pr view and pr diff reach the real gh with or without the header', () => {
  for (const review of [undefined, 'comment']) {
    for (const verb of ['view', 'diff']) {
      const result = gh(['pr', verb, '--repo', 'acme/demo', 'feature/x'], review);

      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.real, `pr\n${verb}\n--repo\nacme/demo\nfeature/x\n`);
    }
  }
});

// R12 — without the header no GitHub write is allowed at all.
test('without a Review: comment header every write is refused before the real gh runs', () => {
  for (const args of [['pr', 'review', '1', '--comment', '-b', 'x'], ['pr', 'comment', '1'], ['pr', 'ready'], ['pr', 'merge', '1'], ['api', '-X', 'POST', 'repos/acme/demo/issues']]) {
    const result = gh(args);

    assert.equal(result.code, 1, args.join(' '));
    assert.match(result.stderr, /refused/);
    assert.equal(result.real, '', args.join(' '));
  }
});

// R12 — with the header, a comment review passes and nothing else does.
test('under the header a comment review reaches the real gh', () => {
  const result = gh(['pr', 'review', '1', '--repo', 'acme/demo', '--comment', '--body', 'banner'], 'comment');

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.real, 'pr\nreview\n1\n--repo\nacme/demo\n--comment\n--body\nbanner\n');
});

test('under the header --request-changes, -r, --approve, -a and a review with no --comment are refused', () => {
  for (const flag of [['--request-changes'], ['-r'], ['--approve'], ['-a'], ['--comment', '--request-changes'], ['-c', '-r'], []]) {
    const result = gh(['pr', 'review', '1', ...flag, '-b', 'x'], 'comment');

    assert.equal(result.code, 1, flag.join(' '));
    assert.equal(result.real, '', flag.join(' '));
  }
});

test('under the header every other GitHub write is still refused', () => {
  for (const args of [['pr', 'comment', '1', '-b', 'x'], ['pr', 'merge', '1'], ['pr', 'ready'], ['pr', 'close', '1'], ['api', 'repos/acme/demo/pulls/1/reviews', '-f', 'event=APPROVE']]) {
    const result = gh(args, 'comment');

    assert.equal(result.code, 1, args.join(' '));
    assert.equal(result.real, '', args.join(' '));
  }
});
