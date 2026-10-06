import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { SkillRef } from './repo-coherence.ts';
import type { Finding } from './verdict.ts';

const SOURCE = 'skills:plugin-conventions';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

const failing = (rule: string, detail: string): Finding => ({ rule, status: 'fail', detail, source: SOURCE });

export const listEvals = (repoRoot: string, skills: readonly SkillRef[]): string[] => {
  const pluginsRoot = join(repoRoot, 'plugins');
  const pluginEvals = existsSync(pluginsRoot)
    ? readdirSync(pluginsRoot, { withFileTypes: true })
        .filter((plugin) => plugin.isDirectory())
        .map((plugin) => join(pluginsRoot, plugin.name, 'evals', 'evals.json'))
    : [];
  const skillEvals = skills.map((skill) => join(skill.dir, 'evals', 'evals.json'));

  return [...pluginEvals, ...skillEvals].filter((path) => existsSync(path));
};

const routingCaseFindings = (entry: unknown, index: number, knownSkills: ReadonlySet<string>): Finding[] => {
  const routingCase = isRecord(entry) ? entry : {};
  const skills: readonly unknown[] = Array.isArray(routingCase['skills']) ? routingCase['skills'] : [];
  const expectedBehavior: readonly unknown[] = Array.isArray(routingCase['expected_behavior']) ? routingCase['expected_behavior'] : [];
  const findings: Finding[] = [];

  if (!isFilled(routingCase['query'])) {
    findings.push(failing('evals-routing-shape', `routing[${index}] has no query`));
  }

  if (skills.length === 0) {
    findings.push(failing('evals-routing-shape', `routing[${index}] names no skill`));
  }

  for (const skill of skills) {
    if (typeof skill !== 'string' || !knownSkills.has(skill)) {
      findings.push(failing('evals-skills-exist', `routing[${index}] names ${JSON.stringify(skill)}, which is not a plugin:skill of this marketplace`));
    }
  }

  if (!expectedBehavior.some(isFilled)) {
    findings.push(failing('evals-routing-shape', `routing[${index}] has no expected_behavior`));
  }

  return findings;
};

export const evalsFindings = (evalsPath: string, skills: readonly SkillRef[]): Finding[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(evalsPath, 'utf8'));
  } catch (error) {
    return [failing('evals-routing-shape', `not valid JSON: ${(error as Error).message}`)];
  }

  const routing: readonly unknown[] = isRecord(parsed) && Array.isArray(parsed['routing']) ? parsed['routing'] : [];

  if (routing.length === 0) {
    return [failing('evals-routing-shape', 'has no routing case')];
  }

  const knownSkills = new Set(skills.map((skill) => `${skill.plugin}:${skill.name}`));
  const findings = routing.flatMap((entry, index) => routingCaseFindings(entry, index, knownSkills));

  return findings.length > 0
    ? findings
    : [{ rule: 'evals-routing-shape', status: 'pass', detail: `${routing.length} routing case(s), every skill resolves`, source: SOURCE }];
};
