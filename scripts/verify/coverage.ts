import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join, matchesGlob } from 'node:path';

import type { Check } from './ports.ts';

export const DECLARED_EXCLUSION = 'plugins/superpowers/skills/systematic-debugging/condition-based-waiting-example.ts';

const TEST_FILE = /^(?:.+\.test\.ts|test[-_].+\.sh)$/;

const SPAWN_TIMEOUT_MS = 60_000;

export const workTree = (root: string): readonly string[] => {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  });

  if (listed.status !== 0) {
    throw new Error(`git ls-files failed: ${listed.error?.message ?? listed.stderr.trim()}`);
  }

  return [...new Set(listed.stdout.split('\0'))].filter((path) => path !== '' && existsSync(join(root, path)));
};

const runners = (checks: readonly Check[], file: string): readonly string[] =>
  checks.flatMap((check) =>
    'command' in check && [...check.command, ...(check.runs ?? [])].some((word) => word === file || matchesGlob(file, word))
      ? [check.name]
      : [],
  );

const typeScope = (root: string): ReadonlySet<string> => {
  const shown = spawnSync(join(root, 'node_modules', '.bin', 'tsc'), ['--showConfig'], {
    cwd: root,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  });

  if (shown.status !== 0) {
    throw new Error(`tsc --showConfig failed: ${shown.error?.message ?? `${shown.stdout}${shown.stderr}`.trim()}`);
  }

  const config = JSON.parse(shown.stdout) as { readonly files?: readonly string[] };

  return new Set((config.files ?? []).map((file) => file.replace(/^\.\//, '')));
};

export const everyTestRuns = (root: string, checks: readonly Check[]): readonly string[] => {
  const files = workTree(root);
  const scope = typeScope(root);

  return [
    ...files
      .filter((file) => TEST_FILE.test(basename(file)))
      .flatMap((file) => {
        const names = runners(checks, file);

        if (names.length === 1) {
          return [];
        }

        return names.length === 0 ? [`no check runs ${file}`] : [`${file} runs under ${names.length} checks: ${names.join(', ')}`];
      }),
    ...files
      .filter((file) => file.endsWith('.ts') && file !== DECLARED_EXCLUSION && !scope.has(file))
      .map((file) => `${file} is outside the type-check scope; only ${DECLARED_EXCLUSION} may be`),
  ];
};
