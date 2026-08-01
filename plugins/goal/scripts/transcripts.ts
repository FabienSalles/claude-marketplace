// Turns a run's cwd and plan into the transcript paths Claude Code already persisted for it.
//
// No session id is recorded structurally: the implementer's, the lens's, the reviewer's and the
// supervising command's own session all open with a prompt that names the plan, so that name is
// the anchor a transcript is matched against — additive, since nothing about how a session is
// written needs to change for this to work.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const PROJECTS_ROOT = join(homedir(), '.claude', 'projects');

// Claude Code keys a project's transcripts by its absolute cwd with every `/` turned into a `-`.
export const projectDir = (cwd: string, root: string = PROJECTS_ROOT): string =>
  join(root, cwd.replace(/\//g, '-'));

export const runTranscripts = (cwd: string, plan: string, root: string = PROJECTS_ROOT): string[] => {
  const dir = projectDir(cwd, root);

  if (!existsSync(dir)) {
    return [];
  }

  const needle = basename(plan);

  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.jsonl'))
    .map((entry) => join(dir, entry))
    .filter((path) => readFileSync(path, 'utf8').includes(needle));
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
