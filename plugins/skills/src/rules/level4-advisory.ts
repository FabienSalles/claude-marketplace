import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from '../verdict.ts';

const MAX_BODY_LINES = 500;
const SOURCE = 'platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices';

export const level4Findings = (skillDir: string): Finding[] => {
  const skillMdPath = join(skillDir, 'SKILL.md');
  let content: string;

  try {
    content = readFileSync(skillMdPath, 'utf8');
  } catch {
    return [{ rule: 'body-max-lines', status: 'fail', detail: `cannot read ${skillMdPath}`, source: SOURCE }];
  }

  const lineCount = content.split('\n').length;
  const withinLimit = lineCount <= MAX_BODY_LINES;

  return [
    {
      rule: 'body-max-lines',
      status: withinLimit ? 'pass' : 'fail',
      detail: withinLimit
        ? `body is ${lineCount} lines <= ${MAX_BODY_LINES}`
        : `body is ${lineCount} lines > ${MAX_BODY_LINES}`,
      source: SOURCE,
    },
  ];
};
