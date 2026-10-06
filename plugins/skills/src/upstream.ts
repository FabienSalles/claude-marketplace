import { spawnSync } from 'node:child_process';

import type { SkillRef } from './repo-coherence.ts';
import { CLAUDE_CODE_FIELDS } from './rules/level2.ts';
import { aggregateLevel, aggregateVerdict, type Finding, type Verdict } from './verdict.ts';

const SKILLS_REF = 'git+https://github.com/agentskills/agentskills#subdirectory=skills-ref';

const UNEXPECTED_FIELDS_PATTERN = /^Unexpected fields in frontmatter: (.+)\. Only \[/;
const ERROR_LINE_PREFIX = '  - ';

export type UpstreamResult =
  | { readonly ok: true; readonly verdicts: readonly Verdict[] }
  | { readonly ok: false; readonly reason: string };

const skillsRef = (args: readonly string[]) =>
  spawnSync('uvx', ['--quiet', '--from', SKILLS_REF, 'skills-ref', ...args], { encoding: 'utf8' });

const isDeclaredDivergence = (error: string): boolean => {
  const fields = UNEXPECTED_FIELDS_PATTERN.exec(error)?.[1];

  return fields !== undefined && fields.split(', ').every((field) => CLAUDE_CODE_FIELDS.includes(field));
};

const failing = (rule: string, detail: string): Finding => ({ rule, status: 'fail', detail, source: SKILLS_REF });

const upstreamVerdict = (skillDir: string): Verdict => {
  const run = skillsRef(['validate', skillDir]);
  const output = `${run.stdout}${run.stderr}`;
  const errors = output
    .split('\n')
    .filter((line) => line.startsWith(ERROR_LINE_PREFIX))
    .map((line) => line.slice(ERROR_LINE_PREFIX.length));
  const failures =
    run.status !== 0 && errors.length === 0
      ? [`exited ${String(run.status)} without a validation error: ${output.trim()}`]
      : errors.filter((error) => !isDeclaredDivergence(error));

  return aggregateVerdict(skillDir, [
    aggregateLevel(2, true, failures.map((error) => failing('skills-ref', error))),
    aggregateLevel(2, false, errors.filter(isDeclaredDivergence).map((error) => failing('skills-ref-declared-divergence', error))),
  ]);
};

export const validateUpstream = (skills: readonly Pick<SkillRef, 'dir'>[]): UpstreamResult => {
  const probe = skillsRef(['--version']);

  if (probe.error !== undefined) {
    return { ok: false, reason: `uvx not found (${probe.error.message}): --upstream runs ${SKILLS_REF} through uv, install uv first (docs.astral.sh/uv)` };
  }

  if (probe.status !== 0) {
    return { ok: false, reason: `uvx could not fetch ${SKILLS_REF}: --upstream needs network access\n${probe.stdout}${probe.stderr}` };
  }

  return { ok: true, verdicts: skills.map((skill) => upstreamVerdict(skill.dir)) };
};
