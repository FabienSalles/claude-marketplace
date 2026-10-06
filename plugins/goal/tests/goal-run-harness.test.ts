import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmodSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { git, repo, runInProcess, sharedFake } from './support/goal-run-harness.ts';
import { tmpDir } from './support/tmp.ts';

test('a pilot run waiting out a quota rejects once its signal aborts, instead of sleeping on', async () => {
  const fixture = repo();

  await assert.rejects(
    runInProcess(
      fixture,
      [fixture.plan, '1'],
      {
        FAKE_CLAUDE_QUOTA_UNTIL: '1',
        FAKE_CLAUDE_QUOTA_COUNTER: join(fixture.dir, 'quota-counter'),
        GOAL_RUN_QUOTA_SLEEP: '1',
      },
      undefined,
      AbortSignal.abort(),
    ),
    { name: 'AbortError' },
  );
});

const TAMPERS: readonly (readonly [string, (link: string) => void])[] = [
  ['mode', (link) => chmodSync(link, 0o755)],
  [
    'content',
    (link) => {
      chmodSync(link, 0o755);
      writeFileSync(link, '#!/bin/sh\nexit 0\n');
      chmodSync(link, 0o555);
    },
  ],
];

for (const [change, tamper] of TAMPERS) {
  test(`a shared fake whose ${change} changed through a fixture's link is refused by name, never reused`, (t) => {
    const script = `#!/bin/sh\necho ${randomUUID()}\n`;
    const shared = sharedFake(script);
    const link = join(tmpDir('goal-run-harness-'), 'claude');

    t.after(() => rmSync(shared, { force: true }));
    symlinkSync(shared, link);
    tamper(link);

    assert.throws(() => sharedFake(script), (error: Error) => error.message.includes(shared));
  });
}

test('a shared fake carries the uid of the user who wrote it, so another user\'s fake in a shared tmpdir never takes its name', (t) => {
  const shared = sharedFake(`#!/bin/sh\necho ${randomUUID()}\n`);

  t.after(() => rmSync(shared, { force: true }));

  assert.match(basename(shared), new RegExp(`^goal-fake-${process.getuid?.()}-[0-9a-f]{64}$`));
});

test('a git the suite spawns reads no global or system config and runs no maintenance', () => {
  const listed = git(tmpDir('goal-run-harness-'), 'config', '--list', '--show-scope');

  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(listed.stdout.split('\n').filter((line) => line !== ''), ['command\tmaintenance.auto=false']);
});
