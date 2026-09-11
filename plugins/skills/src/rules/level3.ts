import type { Frontmatter } from '../frontmatter.ts';
import type { Finding } from '../verdict.ts';

const MAX_DESCRIPTION_LENGTH = 1024;
const SOURCE =
  'code.visualstudio.com/docs/agent-customization/agent-skills; openai/codex codex-rs/skills/src/parser.rs MAX_DESCRIPTION_LEN; agentskills.io/specification';

export const level3Findings = (frontmatter: Frontmatter): Finding[] => {
  const description = typeof frontmatter.fields['description'] === 'string' ? frontmatter.fields['description'] : '';
  const length = description.length;
  const withinLimit = length <= MAX_DESCRIPTION_LENGTH;

  return [
    {
      rule: 'description-max-length',
      status: withinLimit ? 'pass' : 'fail',
      detail: withinLimit
        ? `description is ${length} <= ${MAX_DESCRIPTION_LENGTH}`
        : `description is ${length} > ${MAX_DESCRIPTION_LENGTH}`,
      source: SOURCE,
    },
  ];
};
