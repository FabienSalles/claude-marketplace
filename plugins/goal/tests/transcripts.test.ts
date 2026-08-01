import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { projectDir, runTranscripts } from '../scripts/transcripts.ts';

const projectRoot = (): string => mkdtempSync(join(tmpdir(), 'transcripts-'));

// R9 — a session id is never recorded structurally; every session Claude Code persists opens
// with a prompt naming the plan, so that name is the only anchor a transcript needs.
test('projectDir encodes the cwd the same way Claude Code names its own project directory', () => {
  const root = projectRoot();

  assert.equal(projectDir('/Users/dev/my-repo', root), join(root, '-Users-dev-my-repo'));
});

// R9 — the resolver reads only transcripts whose own content names the plan, so it finds the
// implementer's, the lens's, the reviewer's and the supervising session's own transcripts alike,
// with nothing new recorded to tie them to this run.
test('runTranscripts returns every transcript under the project dir that names the plan', () => {
  const root = projectRoot();
  const dir = join(root, '-Users-dev-my-repo');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'implementer.jsonl'), 'Implement iteration 3 of my-plan-spec.md\n');
  writeFileSync(join(dir, 'lens.jsonl'), 'Refute the iteration(s) 3 of my-plan-spec.md\n');
  writeFileSync(join(dir, 'unrelated.jsonl'), 'Some other session entirely\n');

  const found = runTranscripts('/Users/dev/my-repo', 'my-plan-spec.md', root);

  assert.deepEqual(found.sort(), [join(dir, 'implementer.jsonl'), join(dir, 'lens.jsonl')].sort());
});

// R9 — a run whose project directory was never created (nothing persisted yet, or a cwd that
// never matched) resolves to no transcripts rather than throwing.
test('runTranscripts returns nothing when the project dir does not exist', () => {
  const root = projectRoot();

  assert.deepEqual(runTranscripts('/Users/dev/never-ran', 'my-plan-spec.md', root), []);
});

// R11 — only `.jsonl` entries are candidates; a stray file dropped beside the transcripts (a
// lock, a `.DS_Store`) is never read as one just because it happens to mention the plan.
test('runTranscripts ignores non-jsonl entries even when they name the plan', () => {
  const root = projectRoot();
  const dir = join(root, '-Users-dev-my-repo');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'notes.txt'), 'my-plan-spec.md\n');

  assert.deepEqual(runTranscripts('/Users/dev/my-repo', 'my-plan-spec.md', root), []);
});
