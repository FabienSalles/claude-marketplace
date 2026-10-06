import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { certifyAgent } from '../src/agents.ts';

const agentFixture = (name: string): string => join(import.meta.dirname, 'fixtures', 'agents', name);
const pluginsRoot = join(import.meta.dirname, 'fixtures', 'agent-plugins');

test('R5 — a valid agent certifies with no failing findings', () => {
  const verdict = certifyAgent(agentFixture('valid.md'), pluginsRoot);

  assert.equal(verdict.status, 'pass');
});

test('R5 — a skills: entry pointing at a nonexistent skill fails certification', () => {
  const verdict = certifyAgent(agentFixture('missing-skill.md'), pluginsRoot);
  const finding = verdict.levels.flatMap((level) => level.findings).find((f) => f.rule === 'skills-exist');

  assert.equal(verdict.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /demo:no-such-skill/);
});

test('R5 — a skills: entry with disable-model-invocation fails certification', () => {
  const verdict = certifyAgent(agentFixture('disabled-skill.md'), pluginsRoot);
  const finding = verdict.levels.flatMap((level) => level.findings).find((f) => f.rule === 'skills-preloadable');

  assert.equal(verdict.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /demo:disabled-skill/);
});

test('R5 — an agent with an unrecognized model fails certification', () => {
  const verdict = certifyAgent(agentFixture('bad-model.md'), pluginsRoot);
  const finding = verdict.levels.flatMap((level) => level.findings).find((f) => f.rule === 'model-valid');

  assert.equal(verdict.status, 'fail');
  assert.equal(finding?.status, 'fail');
});

test('R5 — an agent missing required frontmatter fields fails certification', () => {
  const verdict = certifyAgent(agentFixture('missing-fields.md'), pluginsRoot);
  const finding = verdict.levels.flatMap((level) => level.findings).find((f) => f.rule === 'frontmatter-required-fields');

  assert.equal(verdict.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /name, description/);
});

test('R5 — an unreadable agent file fails closed', () => {
  const verdict = certifyAgent(agentFixture('does-not-exist.md'), pluginsRoot);

  assert.equal(verdict.status, 'fail');
});
