import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

import { aggregateLevel, aggregateVerdict, type Finding, type Verdict } from './verdict.ts';

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;
const REQUIRED_FIELDS = ['name', 'description'];
const VALID_MODELS = ['sonnet', 'opus', 'haiku', 'inherit'];
const SOURCE = 'platform.claude.com/docs/en/agents-and-tools/agent-skills/subagents';

type AgentFrontmatterResult =
  | { readonly ok: true; readonly fields: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly reason: string };

const parseFrontmatter = (content: string): Record<string, unknown> | undefined => {
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    return undefined;
  }

  const parsed: unknown = parse(match[1] ?? '');
  return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
};

const readAgentFrontmatter = (agentPath: string): AgentFrontmatterResult => {
  let content: string;

  try {
    content = readFileSync(agentPath, 'utf8');
  } catch {
    return { ok: false, reason: `cannot read ${agentPath}` };
  }

  const fields = parseFrontmatter(content);

  if (!fields) {
    return { ok: false, reason: `${agentPath} has no YAML frontmatter block` };
  }

  return { ok: true, fields };
};

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const resolveSkillDir = (pluginsRoot: string, skillRef: string): string | undefined => {
  const [plugin, skillName] = skillRef.split(':');
  return plugin && skillName ? join(pluginsRoot, plugin, 'skills', skillName) : undefined;
};

const readSkillFields = (skillDir: string): Record<string, unknown> | undefined => {
  try {
    return parseFrontmatter(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'));
  } catch {
    return undefined;
  }
};

const skillsFindings = (fields: Readonly<Record<string, unknown>>, pluginsRoot: string): Finding[] =>
  asStringList(fields['skills']).map((ref) => {
    const skillDir = resolveSkillDir(pluginsRoot, ref);

    if (!skillDir || !existsSync(join(skillDir, 'SKILL.md'))) {
      return {
        rule: 'skills-exist',
        status: 'fail',
        detail: `skills: entry "${ref}" does not resolve to an existing skill`,
        source: SOURCE,
      };
    }

    const disabled = readSkillFields(skillDir)?.['disable-model-invocation'] === true;

    return {
      rule: 'skills-preloadable',
      status: disabled ? 'fail' : 'pass',
      detail: disabled
        ? `skills: entry "${ref}" has disable-model-invocation set and cannot be preloaded`
        : `skills: entry "${ref}" resolves to a preloadable skill`,
      source: SOURCE,
    };
  });

export const certifyAgent = (agentPath: string, pluginsRoot: string): Verdict => {
  const frontmatterResult = readAgentFrontmatter(agentPath);

  if (!frontmatterResult.ok) {
    const unreadable: Finding = {
      rule: 'frontmatter-readable',
      status: 'fail',
      detail: frontmatterResult.reason,
      source: SOURCE,
    };

    return aggregateVerdict(agentPath, [aggregateLevel(2, true, [unreadable])]);
  }

  const { fields } = frontmatterResult;
  const missing = REQUIRED_FIELDS.filter((name) => !(name in fields));
  const model = typeof fields['model'] === 'string' ? fields['model'] : '';
  const modelValid = VALID_MODELS.includes(model);

  const frontmatterFindings: Finding[] = [
    {
      rule: 'frontmatter-required-fields',
      status: missing.length === 0 ? 'pass' : 'fail',
      detail:
        missing.length === 0
          ? `${REQUIRED_FIELDS.join(', ')} present`
          : `missing required field(s): ${missing.join(', ')}`,
      source: SOURCE,
    },
    {
      rule: 'model-valid',
      status: modelValid ? 'pass' : 'fail',
      detail: modelValid
        ? `model "${model}" is within [${VALID_MODELS.join(', ')}]`
        : `model "${model || '(missing)'}" is not within [${VALID_MODELS.join(', ')}]`,
      source: SOURCE,
    },
  ];

  return aggregateVerdict(agentPath, [
    aggregateLevel(2, true, frontmatterFindings),
    aggregateLevel(3, true, skillsFindings(fields, pluginsRoot)),
  ]);
};
