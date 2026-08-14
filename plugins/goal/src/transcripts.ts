// Turns a run's cwd and plan into the transcript paths Claude Code already persisted for it.
//
// Two anchors, because neither covers the other. Every run directory's own `.run.session`, under
// `.claude/goal-runs/<work-id>/`, holds the ids the runner recorded for the sessions it spawned
// itself, which is exact — one id, one transcript. Together they cannot hold the supervising
// command's own session, which the runner never spawns and whose id it never sees; that one is
// found by its content naming the plan. The scan alone would also match every earlier run of the
// same plan, so the recorded ids are what make this run's own sessions identifiable among them.

import { basename, join } from 'node:path';

import { fs } from './adapters/fs.ts';
import { projectDir } from './core/events.ts';
import { workIdOf } from './core/plan.ts';

export { projectDir } from './core/events.ts';

const PROJECTS_ROOT = join(fs.homeDir(), '.claude', 'projects');

export const recordedTranscripts = (plan: string, dir: string, cwd: string): string[] => {
  const runsRoot = join(cwd, '.claude', 'goal-runs', workIdOf(plan));

  if (!fs.exists(runsRoot)) {
    return [];
  }

  const ids = fs.readDir(runsRoot).flatMap((runId) => {
    const recorded = join(runsRoot, runId, '.run.session');

    if (!fs.exists(recorded)) {
      return [];
    }

    return fs
      .readFile(recorded)
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id !== '');
  });

  return ids.map((id) => join(dir, `${id}.jsonl`)).filter((path) => fs.exists(path));
};

export const runTranscripts = (cwd: string, plan: string, root: string = PROJECTS_ROOT): string[] => {
  const dir = projectDir(cwd, root);

  if (!fs.exists(dir)) {
    return [];
  }

  const needle = basename(plan);

  const scanned = fs
    .readDir(dir)
    .filter((entry) => entry.endsWith('.jsonl'))
    .map((entry) => join(dir, entry))
    .filter((path) => fs.readFile(path).includes(needle));

  return [...new Set([...recordedTranscripts(plan, dir, cwd), ...scanned])];
};

// Usage: node transcripts.ts <cwd> <plan> — one transcript path per line.
if (import.meta.main) {
  const [cwd, plan] = process.argv.slice(2);

  if (cwd === undefined || plan === undefined) {
    process.stderr.write('usage: transcripts.ts <cwd> <plan>\n');
    process.exit(2);
  }

  for (const path of runTranscripts(cwd, plan)) {
    process.stdout.write(`${path}\n`);
  }
}
