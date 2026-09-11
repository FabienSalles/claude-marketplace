import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './verdict.ts';

const SOURCE = 'repo-coherence';
const README_COUNT_PATTERN = /^## Skills \((\d+)\)/m;
const SEE_ALSO_PATTERN = /See also:?[^`]*`([a-z0-9-]+)`/gi;

export type SkillRef = {
  readonly plugin: string;
  readonly name: string;
  readonly dir: string;
};

export const listSkills = (repoRoot: string): SkillRef[] => {
  const pluginsRoot = join(repoRoot, 'plugins');

  if (!existsSync(pluginsRoot)) {
    return [];
  }

  const skills: SkillRef[] = [];

  for (const plugin of readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!plugin.isDirectory()) {
      continue;
    }

    const skillsDir = join(pluginsRoot, plugin.name, 'skills');

    if (!existsSync(skillsDir)) {
      continue;
    }

    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      const skillDir = join(skillsDir, entry.name);

      if (entry.isDirectory() && existsSync(join(skillDir, 'SKILL.md'))) {
        skills.push({ plugin: plugin.name, name: entry.name, dir: skillDir });
      }
    }
  }

  return skills;
};

export const readmeCounterFindings = (repoRoot: string, skills: readonly SkillRef[]): Finding[] => {
  const countByPlugin = new Map<string, number>();

  for (const skill of skills) {
    countByPlugin.set(skill.plugin, (countByPlugin.get(skill.plugin) ?? 0) + 1);
  }

  const findings: Finding[] = [];

  for (const [plugin, actual] of countByPlugin) {
    const readmePath = join(repoRoot, 'plugins', plugin, 'README.md');

    if (!existsSync(readmePath)) {
      continue;
    }

    const match = README_COUNT_PATTERN.exec(readFileSync(readmePath, 'utf8'));

    if (!match) {
      continue;
    }

    const declared = Number(match[1]);
    const matches = declared === actual;

    findings.push({
      rule: 'readme-skill-count',
      status: matches ? 'pass' : 'fail',
      detail: matches
        ? `plugins/${plugin}/README.md declares ${declared} skill(s), matching`
        : `plugins/${plugin}/README.md declares ${declared} skill(s), actual is ${actual}`,
      source: SOURCE,
    });
  }

  return findings;
};

export const seePointerFindings = (skills: readonly SkillRef[]): Finding[] => {
  const knownNames = new Set(skills.map((skill) => skill.name));
  const findings: Finding[] = [];

  for (const skill of skills) {
    const body = readFileSync(join(skill.dir, 'SKILL.md'), 'utf8');

    for (const match of body.matchAll(SEE_ALSO_PATTERN)) {
      const target = match[1];

      if (!target) {
        continue;
      }

      const resolves = knownNames.has(target);

      findings.push({
        rule: 'see-pointer-resolves',
        status: resolves ? 'pass' : 'fail',
        detail: resolves
          ? `${skill.plugin}:${skill.name} points to existing skill "${target}"`
          : `${skill.plugin}:${skill.name} points to nonexistent skill "${target}"`,
        source: SOURCE,
      });
    }
  }

  return findings;
};
