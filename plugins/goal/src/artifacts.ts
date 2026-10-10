import { spawnSync } from 'node:child_process';
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { err, ok, type Result } from './core/result.ts';
import type { Env } from './core/settings.ts';

type Artifacts = {
  project: string;
  root: string;
  plans: string;
  runs: string;
  source: string;
  supplied: boolean;
};

const destination = (path: string): Result<string, string> => {
  let ancestor = path;

  for (;;) {
    try {
      if (!statSync(ancestor).isDirectory()) {
        return err(`GOAL_ROOT_PATH destination is not a directory: ${ancestor}`);
      }

      accessSync(ancestor, constants.W_OK | constants.X_OK);

      return ok(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return err(`GOAL_ROOT_PATH destination is not usable: ${path}`);
      }

      ancestor = dirname(ancestor);
    }
  }
};

export const resolveArtifacts = (cwd: string, env: Env): Result<Artifacts, string> => {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });

  if (git.status !== 0) {
    return err(`cannot resolve the Git project root: ${cwd}`);
  }

  const project = git.stdout.trim();
  let value = env.GOAL_ROOT_PATH;
  let source = 'environment';

  for (const file of ['.env.local', '.env']) {
    if (value !== undefined) break;

    const path = join(project, file);

    try {
      value = parseEnv(readFileSync(path, 'utf8')).GOAL_ROOT_PATH;
      source = file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return err(`cannot read GOAL_ROOT_PATH source: ${path}`);
      }
    }
  }

  if (value !== undefined && (value.trim() === '' || value.includes('\0'))) {
    return err(`GOAL_ROOT_PATH from ${source} is empty or invalid`);
  }

  const selected = destination(resolve(project, value ?? '.goal'));

  if (!selected.ok) return selected;

  const root = selected.value;

  for (const child of ['plans', 'runs']) {
    const checked = destination(join(root, child));

    if (!checked.ok) return checked;
  }

  return ok({ project, root, plans: join(root, 'plans'), runs: join(root, 'runs'), source: value === undefined ? 'default' : source, supplied: value !== undefined });
};

if (import.meta.main) {
  const cwd = process.argv[2];
  const result = cwd === undefined ? err('usage: artifacts.ts <project-directory>') : resolveArtifacts(cwd, process.env);

  if (!result.ok) {
    process.stderr.write(`${result.error}\n`);
    process.exit(2);
  }

  process.stdout.write(`${JSON.stringify(result.value)}\n`);
}
