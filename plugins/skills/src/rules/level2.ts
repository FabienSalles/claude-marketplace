import type { Frontmatter } from '../frontmatter.ts';
import type { Finding } from '../verdict.ts';

const SPEC_FIELDS = ['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'];
const CLAUDE_CODE_FIELDS = ['disable-model-invocation', 'user-invocable', 'context', 'agent', 'model'];
const ALLOWED_FIELDS = [...SPEC_FIELDS, ...CLAUDE_CODE_FIELDS];
const REQUIRED_FIELDS = ['name', 'description'];
const SPEC_SOURCE = 'agentskills.io/specification';
const ANTHROPIC_SOURCE = 'platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices';

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const level2Findings = (frontmatter: Frontmatter): Finding[] => {
  const fieldNames = Object.keys(frontmatter.fields);
  const unexpected = fieldNames.filter((name) => !ALLOWED_FIELDS.includes(name));
  const missing = REQUIRED_FIELDS.filter((name) => !fieldNames.includes(name));
  const description = asString(frontmatter.fields['description']);
  const angleBracketMatch = /[<>]/.exec(description);

  return [
    {
      rule: 'frontmatter-field-whitelist',
      status: unexpected.length === 0 ? 'pass' : 'fail',
      detail:
        unexpected.length === 0
          ? `all fields are within [${ALLOWED_FIELDS.join(', ')}]`
          : `unexpected field(s): ${unexpected.join(', ')}. Only [${ALLOWED_FIELDS.join(', ')}] are allowed`,
      source: SPEC_SOURCE,
    },
    {
      rule: 'frontmatter-required-fields',
      status: missing.length === 0 ? 'pass' : 'fail',
      detail:
        missing.length === 0
          ? `${REQUIRED_FIELDS.join(', ')} present`
          : `missing required field(s): ${missing.join(', ')}`,
      source: SPEC_SOURCE,
    },
    {
      rule: 'description-no-angle-brackets',
      status: angleBracketMatch ? 'fail' : 'pass',
      detail: angleBracketMatch
        ? `description contains "${description[angleBracketMatch.index]}" at position ${angleBracketMatch.index}`
        : 'description contains no angle brackets',
      source: ANTHROPIC_SOURCE,
    },
  ];
};
