import { accessSync, constants, statSync } from 'node:fs';

import { basename, isAbsolute, join } from 'node:path';

import { resolveArtifacts } from './artifacts.ts';

import { fs } from './adapters/fs.ts';
import { projectDir } from './core/events.ts';
import { workIdOf } from './core/plan.ts';

export { projectDir } from './core/events.ts';

const PROJECTS_ROOT = join(fs.homeDir(), '.claude', 'projects');

export const recordedTranscripts = (dir: string, runsRoot: string): string[] => {
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

export const runTranscripts = (cwd: string, plan: string, source: string, runs: string, root: string = PROJECTS_ROOT, history?: string): string[] => {
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

  return [...new Set([...recordedTranscripts(dir, history ?? join(runs, workIdOf(plan, source))), ...scanned])];
};

if (import.meta.main) {
  const [cwd, plan, flag, history, extra] = process.argv.slice(2);

  if (cwd === undefined || plan === undefined) {
    process.stderr.write('usage: transcripts.ts <cwd> <plan> [--runs-path <absolute-work-id-directory>]\n');
    process.exit(2);
  }

  const planPath = isAbsolute(plan) ? plan : join(cwd, plan);

  if (!fs.exists(planPath)) {
    process.stderr.write(`plan not readable: ${planPath}\n`);
    process.exit(2);
  }

  if (flag !== undefined && (flag !== '--runs-path' || history === undefined || extra !== undefined)) {
    process.stderr.write('usage: transcripts.ts <cwd> <plan> [--runs-path <absolute-work-id-directory>]\n');
    process.exit(2);
  }

  if (history !== undefined) {
    try {
      if (!isAbsolute(history) || !statSync(history).isDirectory()) throw new Error();

      accessSync(history, constants.R_OK | constants.X_OK);
    } catch {
      process.stderr.write(`history directory is not readable or absolute: ${history}\n`);
      process.exit(2);
    }
  }

  const artifacts = history === undefined ? resolveArtifacts(cwd, process.env) : undefined;

  if (artifacts !== undefined && !artifacts.ok) {
    process.stderr.write(`${artifacts.error}\n`);
    process.exit(2);
  }

  const runs = artifacts?.ok === true ? artifacts.value.runs : '';

  for (const path of runTranscripts(cwd, plan, fs.readFile(planPath), runs, PROJECTS_ROOT, history)) {
    process.stdout.write(`${path}\n`);
  }
}
