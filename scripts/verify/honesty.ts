import { spawnSync } from 'node:child_process';

import type { Probe, Requirement } from './ports.ts';

const LOCAL_GAPS: readonly string[] = [
  'the ubuntu runner',
  "the latest Claude Code CI installs",
  "health-check's marketplace re-sync",
];

export const gapsFor = (env: NodeJS.ProcessEnv): readonly string[] =>
  env['GITHUB_ACTIONS'] === 'true' ? [] : LOCAL_GAPS;

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
};

export const probeRequirement: Probe = (requirement) => MISSING[requirement]();
