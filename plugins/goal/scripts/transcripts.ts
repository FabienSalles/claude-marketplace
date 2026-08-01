// Turns a run's cwd and plan into the transcript paths Claude Code already persisted for it.
//
// Two anchors, because neither covers the other. `<plan>.run.session` holds the ids the runner
// recorded for the sessions it spawned itself, which is exact — one id, one transcript. It cannot
// hold the supervising command's own session, which the runner never spawns and whose id it never
// sees; that one is found by its content naming the plan. The scan alone would also match every
// earlier run of the same plan, so the recorded ids are what make this run's own sessions
// identifiable among them.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const PROJECTS_ROOT = join(homedir(), '.claude', 'projects');

// Claude Code keys a project's transcripts by its absolute cwd with every `/` turned into a `-`.
export const projectDir = (cwd: string, root: string = PROJECTS_ROOT): string =>
  join(root, cwd.replace(/\//g, '-'));

export const recordedTranscripts = (plan: string, dir: string): string[] => {
  const recorded = `${plan}.run.session`;

  if (!existsSync(recorded)) {
    return [];
  }

  return readFileSync(recorded, 'utf8')
    .split('\n')
    .map((id) => id.trim())
    .filter((id) => id !== '')
    .map((id) => join(dir, `${id}.jsonl`))
    .filter((path) => existsSync(path));
};

export const runTranscripts = (cwd: string, plan: string, root: string = PROJECTS_ROOT): string[] => {
  const dir = projectDir(cwd, root);

  if (!existsSync(dir)) {
    return [];
  }

  const needle = basename(plan);

  const scanned = readdirSync(dir)
    .filter((entry) => entry.endsWith('.jsonl'))
    .map((entry) => join(dir, entry))
    .filter((path) => readFileSync(path, 'utf8').includes(needle));

  return [...new Set([...recordedTranscripts(plan, dir), ...scanned])];
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
