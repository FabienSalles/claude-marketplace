import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Probe, Requirement } from './ports.ts';
import { CLAUDE_PIN } from './workflow.ts';

const LOCAL_GAPS: readonly string[] = [
  'the ubuntu runner',
  "the canary's latest Claude Code and latest Node 24",
  "the goal suite's wall-clock ceiling, applied on CI only",
];

const MAC_RUNNER_BASH = '3.2.';

const NVMRC = join(resolve(import.meta.dirname, '..', '..'), '.nvmrc');

const CLAUDE_VERSION = /^\d+\.\d+\.\d+/;

const versionOf = (program: string, args: readonly string[], env: NodeJS.ProcessEnv): string => {
  const ran = spawnSync(program, args, { env, encoding: 'utf8', timeout: 10_000 });

  return ran.status === 0 ? ran.stdout : 'none';
};

export const gapsFor = (env: NodeJS.ProcessEnv, node: string = process.versions.node): readonly string[] => {
  if (env['GITHUB_ACTIONS'] === 'true') {
    return [];
  }

  const pinnedNode = readFileSync(NVMRC, 'utf8').trim();
  const claude = versionOf('claude', ['--version'], env);
  const claudeVersion = CLAUDE_VERSION.exec(claude)?.[0] ?? claude.trim();
  const bash = versionOf('bash', ['-c', 'printf %s "$BASH_VERSION"'], env);

  return [
    ...LOCAL_GAPS,
    ...(node === pinnedNode ? [] : [`Node ${pinnedNode}, as .nvmrc pins it (this is Node ${node})`]),
    ...(claudeVersion === CLAUDE_PIN ? [] : [`Claude Code ${CLAUDE_PIN}, as plugin-validate pins it (claude here: ${claudeVersion})`]),
    ...(bash.startsWith(MAC_RUNNER_BASH) ? [] : [`the macOS runner's /bin/bash 3.2 (bash on the PATH: ${bash})`]),
  ];
};

export const uncommittedWork = (root: string): readonly string[] => {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });

  return result.status === 0 ? result.stdout.split('\n').filter((entry) => entry !== '' && !entry.endsWith(' node_modules/')) : [];
};

const MISSING: Record<Requirement, () => string | undefined> = {
  claude: () => (spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0 ? undefined : 'the claude CLI'),
  node24: () =>
    process.versions.node.startsWith('24.') ? undefined : `Node 24 (this is Node ${process.versions.node})`,
  network: () => {
    const probe = spawnSync(
      process.execPath,
      ['-e', "require('node:dns').lookup('registry.npmjs.org',(e)=>process.exit(e===null?0:1))"],
      { timeout: 10_000 },
    );

    return probe.status === 0 ? undefined : 'the network';
  },
  uv: () => (spawnSync('uvx', ['--version'], { encoding: 'utf8' }).status === 0 ? undefined : 'uv (uvx on the PATH)'),
};

export const probeRequirement: Probe = (requirement) => MISSING[requirement]();
