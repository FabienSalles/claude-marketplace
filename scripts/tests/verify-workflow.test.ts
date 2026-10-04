import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHECKS } from '../verify/checks.ts';
import { forCi } from '../verify/ci.ts';
import { workflowFindings } from '../verify/workflow.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');

const job = (steps: string, header = ''): string => `
on: [pull_request]
jobs:
  alpha:
    runs-on: ubuntu-latest
${header}    steps:
${steps}`;

const SETUP = `      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
`;

const ENTRY = '      - run: npm run verify -- structure\n';

test('the repository workflow passes its own guard', () => {
  assert.deepEqual(workflowFindings(readFileSync(resolve(ROOT, '.github/workflows/validate.yml'), 'utf8')), []);
});

test('setup steps plus the entry are accepted', () => {
  assert.deepEqual(workflowFindings(job(SETUP + ENTRY)), []);
  assert.deepEqual(workflowFindings(job(SETUP + '      - run: npm install -g @anthropic-ai/claude-code\n' + ENTRY)), []);
});

test('a raw check step is refused, named', () => {
  const findings = workflowFindings(job(`${SETUP}      - name: Sneaky check\n        run: jq empty a.json\n${ENTRY}`));
  assert.equal(findings.length, 1);
  assert.match(findings[0] ?? '', /Sneaky check/);
  assert.match(findings[0] ?? '', /alpha/);
});

test('an unnamed raw step is named by its command', () => {
  assert.match(workflowFindings(job(`${SETUP}      - run: ./scripts/x.sh\n${ENTRY}`)).join('\n'), /x\.sh/);
});

test('an entry naming an unknown group is refused', () => {
  assert.equal(workflowFindings(job(`${SETUP}      - run: npm run verify -- nonsense\n`)).length > 0, true);
});

test('setup-node on another Node is refused', () => {
  const old = SETUP.replace("'24'", "'20'");
  assert.equal(workflowFindings(job(old + ENTRY)).length, 1);
});

test('an action outside the allowlist is refused', () => {
  assert.equal(workflowFindings(job(`${SETUP}      - uses: astral-sh/setup-uv@v5\n${ENTRY}`)).length, 1);
});

test('a job without the entry is refused', () => {
  assert.equal(workflowFindings(job(SETUP)).length, 1);
});

test('a schedule-only job is not judged', () => {
  const nightly = job('      - run: uvx anything\n', "    if: github.event_name == 'schedule'\n");
  assert.deepEqual(workflowFindings(nightly), []);
});

test('CI mode runs health-check in full and drops the diff certification outside a pull request', () => {
  const push = forCi(CHECKS, { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' });
  const pull = forCi(CHECKS, { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' });
  const diff = (checks: typeof CHECKS): number => checks.filter((check) => 'command' in check && check.command.includes('--diff')).length;
  const health = (checks: typeof CHECKS): string =>
    checks.flatMap((check) => ('command' in check && check.command[0] === './scripts/health-check.sh' ? [check.command.join(' ')] : [])).join();

  assert.equal(diff(push), 0);
  assert.equal(diff(pull), 1);
  assert.equal(health(pull), './scripts/health-check.sh');
  assert.equal(health(push), './scripts/health-check.sh');
});

test('outside CI the checks are unchanged', () => {
  assert.equal(forCi(CHECKS, {}), CHECKS);
});

test('the docs and the workflow carry no copied ceiling, check list or second install', () => {
  for (const path of ['.github/workflows/validate.yml', 'plugins/goal/README.md', 'CONTRIBUTING.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8');
    assert.doesNotMatch(text, /--wall \d/, path);
    assert.doesNotMatch(text, /deliberately not vendored|validate-skills\.sh|are CI concerns|npm install --no-save/, path);
  }

  assert.doesNotMatch(readFileSync(resolve(ROOT, 'CONTRIBUTING.md'), 'utf8'), /macos-latest/);
});
