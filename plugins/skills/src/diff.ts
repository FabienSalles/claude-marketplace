import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

import { certifyAgent } from './agents.ts';
import { readFrontmatter } from './frontmatter.ts';
import { level2Findings } from './rules/level2.ts';
import { level3Findings } from './rules/level3.ts';
import { aggregateLevel, aggregateVerdict, type Finding, type Verdict } from './verdict.ts';

const SPEC_SOURCE = 'agentskills.io/specification';

const certifySkill = (skillDir: string): Verdict => {
  const frontmatterResult = readFrontmatter(skillDir);

  if (!frontmatterResult.ok) {
    const unreadable: Finding = {
      rule: 'frontmatter-readable',
      status: 'fail',
      detail: frontmatterResult.reason,
      source: SPEC_SOURCE,
    };

    return aggregateVerdict(skillDir, [aggregateLevel(2, true, [unreadable]), aggregateLevel(3, true, [unreadable])]);
  }

  const { frontmatter } = frontmatterResult;

  return aggregateVerdict(skillDir, [
    aggregateLevel(2, true, level2Findings(frontmatter)),
    aggregateLevel(3, true, level3Findings(frontmatter)),
  ]);
};

export type ArtifactStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export type ChangedArtifact = {
  readonly path: string;
  readonly status: ArtifactStatus;
};

const STATUS_BY_CODE: Readonly<Record<string, ArtifactStatus>> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
};

const isTrackedArtifact = (path: string): boolean =>
  !path.includes('/tests/') &&
  (path.endsWith('/SKILL.md') || (path.endsWith('.md') && path.includes('/agents/')));

export const changedArtifacts = (baseRef: string, repoRoot: string): ChangedArtifact[] => {
  const output = execFileSync('git', ['diff', '--name-status', baseRef, '--', 'plugins'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [rawStatus, ...paths] = line.split('\t');
      const status = STATUS_BY_CODE[(rawStatus ?? '').charAt(0)] ?? 'modified';
      const path = paths[paths.length - 1] ?? '';

      return { path, status };
    })
    .filter((artifact) => isTrackedArtifact(artifact.path));
};

export type DiffGateResult = {
  readonly status: 'pass' | 'fail';
  readonly verdicts: readonly Verdict[];
};

export const runDiffGate = (baseRef: string, repoRoot: string): DiffGateResult => {
  const artifacts = changedArtifacts(baseRef, repoRoot).filter((artifact) => artifact.status !== 'deleted');

  const verdicts = artifacts.map((artifact) => {
    const fullPath = join(repoRoot, artifact.path);

    return artifact.path.endsWith('/SKILL.md')
      ? certifySkill(dirname(fullPath))
      : certifyAgent(fullPath, dirname(dirname(dirname(fullPath))));
  });

  return {
    status: verdicts.some((verdict) => verdict.status === 'fail') ? 'fail' : 'pass',
    verdicts,
  };
};
