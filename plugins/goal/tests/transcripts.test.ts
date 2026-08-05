import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { projectDir, runTranscripts } from '../scripts/transcripts.ts';
import { tmpDir } from './support/tmp.ts';

const projectRoot = (): string => tmpDir('transcripts-');

// R9 — the project directory Claude Code writes into is derived from the cwd alone, so both
// anchors below look in the same place.
test('projectDir encodes the cwd the same way Claude Code names its own project directory', () => {
  const root = projectRoot();

  assert.equal(projectDir('/Users/dev/my-repo', root), join(root, '-Users-dev-my-repo'));
});

// R8 — Claude Code replaces both `/` and `.`, not `/` alone: a run made from a dotted path (a
// worktree under `.claude/worktrees`, say) still resolves to the directory Claude Code wrote.
test('projectDir also encodes the dots in the cwd, the way Claude Code does', () => {
  const root = projectRoot();

  assert.equal(
    projectDir('/Users/dev/dotfiles/.claude/worktrees/x', root),
    join(root, '-Users-dev-dotfiles--claude-worktrees-x'),
  );
});

// R9 — the content scan is what finds a session the runner never spawned, and therefore never
// recorded an id for: the supervising command's own.
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

// R9 — the ids `report.ts` records for the sessions the runner spawned resolve exactly, without
// reading a transcript's content, and a transcript found both ways is returned once.
test('runTranscripts unions the recorded session ids with the content scan, without duplicates', () => {
  const root = projectRoot();
  const repoDir = tmpDir('transcripts-repo-');
  const dir = join(root, repoDir.replace(/[/.]/g, '-'));
  const plan = join(repoDir, '.claude', 'plans', 'my-plan-spec.md');
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'implementer.jsonl'), 'Implement iteration 3 of my-plan-spec.md\n');
  writeFileSync(join(dir, 'silent.jsonl'), 'a session that never names the plan\n');

  const runDir = join(repoDir, '.claude', 'goal-runs', 'my-plan', 'run-1');
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, '.run.session'), 'implementer\nsilent\nvanished\n');

  const found = runTranscripts(repoDir, plan, root);

  assert.deepEqual(found.sort(), [join(dir, 'implementer.jsonl'), join(dir, 'silent.jsonl')].sort());
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
