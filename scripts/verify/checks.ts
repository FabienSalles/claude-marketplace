import { everyTestRuns } from './coverage.ts';
import { hookCommands } from './hooks.ts';
import { catalogParity, catalogSources, catalogValid, pluginManifests } from './manifests.ts';
import type { Check } from './ports.ts';
import { workflowGuard } from './workflow.ts';

export const CEILING_SECONDS = 80;

const SHELL_SUITES = [
  'plugins/security-runtime/tests/test_claudemd-scanner.sh',
  'plugins/security-runtime/tests/test_prompt-injection-detector.sh',
  'plugins/security-runtime/tests/test_secret-file-guard.sh',
  'plugins/superpowers/tests/test-find-polluter.sh',
  'plugins/common/tests/test-hooks.sh',
  'plugins/git/tests/test-fetch-first.sh',
  'plugins/mac/tests/test-bsd-gnu-lint.sh',
  'plugins/tooling/tests/test-fix-drizzle-journal-timestamp.sh',
];

const META_SUITES = ['scripts/tests/test-skill-coherence.sh', 'scripts/tests/test-validate-anchors.sh'];

const BASH = process.platform === 'darwin' ? '/bin/bash' : 'bash';

const NODE_TEST = ['node', '--test', '--test-timeout=60000'];

const TESTS_PASSED = /^ℹ pass [1-9]\d*$/m;

const SUITE_PASSED = /^Total: [1-9]\d* pass, 0 fail$/m;

const UNDECLARED_SKIP = /^[ \t]*﹣ .* # SKIP$/m;

const VALIDATE_EACH_PLUGIN =
  'for plugin_dir in plugins/*/; do claude plugin validate --strict "$plugin_dir" || exit 1; done';

const DECLARED: readonly Check[] = [
  { name: 'marketplace.json is valid', group: 'structure', requirements: [], inline: catalogValid },
  { name: 'every plugin has a valid plugin.json', group: 'structure', requirements: [], inline: pluginManifests },
  { name: 'marketplace.json agrees with each plugin.json', group: 'structure', requirements: [], inline: catalogParity },
  { name: 'every local marketplace source exists', group: 'structure', requirements: [], inline: catalogSources },
  { name: 'the workflow runs every group through the entry and nothing else', group: 'structure', requirements: [], inline: workflowGuard },
  { name: 'hook commands and plugin-root references resolve', group: 'structure', requirements: [], inline: hookCommands },
  {
    name: 'every test runs under one check and every .ts is type-checked',
    group: 'structure',
    requirements: [],
    inline: (root) => everyTestRuns(root, CHECKS),
  },
  {
    name: 'every skill, agent and evals file certified',
    group: 'structure',
    requirements: [],
    command: ['node', 'plugins/skills/scripts/certify.ts', '--all'],
    expectOutput: /^Certified [1-9]\d* skill\(s\), \d+ agent\(s\), \d+ evals file\(s\): 0 blocking failure\(s\), \d+ advisory finding\(s\)$/m,
  },
  {
    name: 'goal plugin doc anchors',
    group: 'structure',
    requirements: [],
    command: ['./scripts/validate-anchors.sh', 'plugins/goal'],
    expectOutput: /^[1-9]\d* anchors checked: /m,
  },
  {
    name: 'goal plugin module headers',
    group: 'structure',
    requirements: [],
    command: ['./scripts/no-module-headers.sh', 'plugins/goal'],
    expectOutput: /^✓ [1-9]\d* module\(s\) checked/m,
  },
  ...META_SUITES.map(
    (suite): Check => ({
      name: suite,
      group: 'structure',
      requirements: [],
      command: [BASH, suite],
      expectOutput: SUITE_PASSED,
    }),
  ),
  {
    name: 'lint',
    group: 'structure',
    requirements: [],
    command: ['node', 'node_modules/eslint/bin/eslint.js', '--config', 'eslint.config.js', 'plugins', 'scripts'],
  },
  { name: 'type-check', group: 'structure', requirements: [], command: ['node', 'node_modules/typescript/bin/tsc', '--noEmit'] },
  {
    name: 'scripts, skills and node-test example tests',
    group: 'unit',
    requirements: [],
    command: [
      ...NODE_TEST,
      '--experimental-test-module-mocks',
      'scripts/tests/*.test.ts',
      'plugins/skills/tests/*.test.ts',
      'plugins/node-test/skills/node-test-conventions/references/*.test.ts',
    ],
    expectOutput: TESTS_PASSED,
    refuseOutput: UNDECLARED_SKIP,
  },
  ...SHELL_SUITES.map(
    (suite): Check => ({
      name: suite,
      group: 'shell-suites',
      requirements: [],
      command: [BASH, suite],
      expectOutput: SUITE_PASSED,
    }),
  ),
  {
    name: 'goal gate suite',
    group: 'goal-gate',
    requirements: [],
    command: ['node', 'plugins/goal/tests/support/budget.ts', '--runs', '1', '--wall', String(CEILING_SECONDS)],
    runs: ['plugins/goal/tests/*.test.ts'],
    exclusive: true,
    timeoutSeconds: 300,
  },
  {
    name: 'goal gate capture suite bites',
    group: 'mutation',
    requirements: [],
    command: ['bash', 'plugins/goal/tests/support/mutate.sh'],
    exclusive: true,
  },
  {
    name: 'claude plugin validate --strict marketplace',
    group: 'plugin-validate',
    requirements: ['claude'],
    command: ['claude', 'plugin', 'validate', '--strict', '.'],
  },
  {
    name: 'claude plugin validate --strict each plugin',
    group: 'plugin-validate',
    requirements: ['claude'],
    command: ['bash', '-c', VALIDATE_EACH_PLUGIN],
  },
  {
    name: 'the pinned skills CLI discovers every skill',
    group: 'skills-discovery',
    requirements: ['network'],
    command: ['node', 'scripts/verify/discovery.ts'],
  },
  {
    name: 'skills network tests',
    group: 'skills-discovery',
    requirements: ['network'],
    command: [...NODE_TEST, 'plugins/skills/tests/network/*.test.ts'],
    expectOutput: TESTS_PASSED,
    refuseOutput: UNDECLARED_SKIP,
  },
  {
    name: 'every skill installs with skills@latest',
    group: 'canary',
    requirements: ['network'],
    command: ['node', 'plugins/skills/scripts/certify.ts', '--install-all', '--cli', 'skills@latest'],
    expectOutput: /^Sandboxed install of [1-9]\d* skill\(s\) with \S+: 0 failure\(s\)$/m,
  },
  {
    name: 'the upstream skills-ref validator agrees',
    group: 'canary',
    requirements: ['network', 'uv'],
    command: ['node', 'plugins/skills/scripts/certify.ts', '--upstream'],
    expectOutput: /^Upstream skills-ref validation of [1-9]\d* skill\(s\): 0 failure\(s\), \d+ declared divergence\(s\)$/m,
    timeoutSeconds: 300,
  },
  {
    name: 'the latest claude plugin validate --strict marketplace',
    group: 'canary',
    requirements: ['claude'],
    command: ['claude', 'plugin', 'validate', '--strict', '.'],
  },
  {
    name: 'the latest claude plugin validate --strict each plugin',
    group: 'canary',
    requirements: ['claude'],
    command: ['bash', '-c', VALIDATE_EACH_PLUGIN],
  },
  {
    name: 'skills@latest discovers every skill',
    group: 'canary',
    requirements: ['network'],
    command: ['node', 'scripts/verify/discovery.ts', '--cli', 'skills@latest'],
  },
];

const runsOnNode = (check: Check): boolean => 'inline' in check || check.command[0] === 'node';

export const CHECKS: readonly Check[] = DECLARED.map((check) =>
  runsOnNode(check) ? { ...check, requirements: [...check.requirements, 'node24'] } : check,
);
