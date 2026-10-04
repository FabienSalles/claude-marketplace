import type { Check } from './ports.ts';
import { catalogParity, catalogSources, catalogValid, pluginManifests } from './manifests.ts';

export const CEILING_SECONDS = 63;

export const GROUPS: readonly string[] = [
  'structure',
  'plugin-validate',
  'skills-discovery',
  'goal-gate',
  'shell-suites',
  'health-check',
];

const SHELL_SUITES = [
  'plugins/security-runtime/tests/test_claudemd-scanner.sh',
  'plugins/security-runtime/tests/test_prompt-injection-detector.sh',
  'plugins/security-runtime/tests/test_secret-file-guard.sh',
  'plugins/superpowers/tests/test-find-polluter.sh',
  'scripts/tests/test-skill-coherence.sh',
];

const VALIDATE_EACH_PLUGIN =
  'for plugin_dir in plugins/*/; do claude plugin validate "$plugin_dir" || exit 1; done';

export const CHECKS: readonly Check[] = [
  { name: 'marketplace.json is valid', group: 'structure', requirements: [], inline: catalogValid },
  { name: 'every plugin has a valid plugin.json', group: 'structure', requirements: [], inline: pluginManifests },
  { name: 'marketplace.json agrees with each plugin.json', group: 'structure', requirements: [], inline: catalogParity },
  { name: 'every local marketplace source exists', group: 'structure', requirements: [], inline: catalogSources },
  { name: 'skill stock coherence', group: 'structure', requirements: [], command: ['node', 'plugins/skills/scripts/certify.ts', '--stock'] },
  {
    name: 'changed skills certified against the diff',
    group: 'structure',
    requirements: [],
    command: ['node', 'plugins/skills/scripts/certify.ts', '--diff', 'origin/main'],
  },
  { name: 'goal plugin doc anchors', group: 'structure', requirements: [], command: ['./scripts/validate-anchors.sh', 'plugins/goal'] },
  { name: 'goal plugin doc counts', group: 'structure', requirements: [], command: ['./scripts/check-doc-counts.sh', 'plugins/goal'] },
  {
    name: 'scripts tests',
    group: 'structure',
    requirements: [],
    command: ['node', '--test', 'scripts/tests/*.test.ts'],
    expectOutput: /^ℹ tests [1-9]\d*$/m,
  },
  { name: 'claude plugin validate marketplace', group: 'plugin-validate', requirements: ['claude'], command: ['claude', 'plugin', 'validate', '.'] },
  { name: 'claude plugin validate each plugin', group: 'plugin-validate', requirements: ['claude'], command: ['bash', '-c', VALIDATE_EACH_PLUGIN] },
  {
    name: 'npx skills discovery',
    group: 'skills-discovery',
    requirements: ['network'],
    command: ['npx', '--yes', 'skills', 'add', '.', '--list'],
    expectOutput: /Found \d+ skills/,
  },
  {
    name: 'goal gate suite under its ceiling',
    group: 'goal-gate',
    requirements: [],
    command: ['node', 'plugins/goal/tests/support/budget.ts', '--runs', '1', '--wall', String(CEILING_SECONDS)],
  },
  { name: 'goal gate capture suite bites', group: 'goal-gate', requirements: [], command: ['bash', 'plugins/goal/tests/support/mutate.sh'] },
  { name: 'goal gate lint', group: 'goal-gate', requirements: [], command: ['npx', 'eslint', '--config', 'eslint.config.js', 'plugins/goal', 'scripts'] },
  { name: 'goal gate type-check', group: 'goal-gate', requirements: [], command: ['npx', 'tsc', '--noEmit'] },
  ...SHELL_SUITES.map((suite): Check => ({ name: suite, group: 'shell-suites', requirements: [], command: ['bash', suite] })),
  { name: 'health-check.sh', group: 'health-check', requirements: ['claude'], command: ['./scripts/health-check.sh', '--quick'] },
];
