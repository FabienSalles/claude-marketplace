import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { certify } from '../scripts/certify.ts';
import { certifyPluginStructure } from '../src/plugin-structure.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);

test('R1 — certify emits one verdict per level, 2 through 4', () => {
  const verdict = certify(fixture('valid'));

  assert.deepEqual(
    verdict.levels.map((level) => level.level),
    [2, 3, 4],
  );
  assert.equal(verdict.levels[2]?.blocking, false, 'level 4 is advisory, not blocking');
  assert.equal(verdict.levels[0]?.blocking, true);
  assert.equal(verdict.levels[1]?.blocking, true);
});

test('R2 — description over 1024 chars fails level 3 with the exact length cited', () => {
  const verdict = certify(fixture('long-description'));
  const level3 = verdict.levels.find((level) => level.level === 3);
  const finding = level3?.findings.find((f) => f.rule === 'description-max-length');

  assert.equal(level3?.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.equal(finding?.detail, 'description is 1243 > 1024');
  assert.match(finding?.source ?? '', /agentskills\.io/);
  assert.equal(verdict.status, 'fail');
});

test('R3 — an angle bracket in the description fails level 2', () => {
  const verdict = certify(fixture('angle-brackets'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'description-no-angle-brackets');

  assert.equal(level2?.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /position/);
  assert.match(finding?.source ?? '', /platform\.claude\.com/);
});

test('R4 — an unexpected frontmatter field fails level 2, naming the field', () => {
  const verdict = certify(fixture('unexpected-field'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'frontmatter-field-whitelist');

  assert.equal(level2?.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /unexpected field\(s\): version/);
});

test('R9 — a skill directory with no SKILL.md fails closed on both blocking levels', () => {
  const verdict = certify(fixture('missing-skillmd'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const level3 = verdict.levels.find((level) => level.level === 3);

  assert.equal(level2?.status, 'fail');
  assert.equal(level3?.status, 'fail');
  assert.equal(verdict.status, 'fail');
});

test('R9 — certifying the same compliant skill twice returns the same passing verdict', () => {
  const first = certify(fixture('valid'));
  const second = certify(fixture('valid'));

  assert.deepEqual(first, second);
  assert.equal(first.status, 'pass');
});

test('R1 — a body over the advisory line ceiling fails level 4 without failing the overall verdict', () => {
  const verdict = certify(fixture('long-body'));
  const level4 = verdict.levels.find((level) => level.level === 4);

  assert.equal(level4?.status, 'fail');
  assert.equal(level4?.blocking, false);
  assert.equal(verdict.status, 'pass');
});

test('I2 — a skill-less plugin with a valid plugin.json passes on structure', () => {
  const verdict = certifyPluginStructure(fixture('plugin-no-skills'));

  assert.equal(verdict.status, 'pass');
});

test('I2 — a skill-less plugin with malformed plugin.json fails closed', () => {
  const verdict = certifyPluginStructure(fixture('plugin-broken-json'));

  assert.equal(verdict.status, 'fail');
});

test('I2 — a skill-less plugin with no plugin.json fails closed', () => {
  const verdict = certifyPluginStructure(fixture('plugin-no-manifest'));

  assert.equal(verdict.status, 'fail');
});

test('R4 — Claude Code platform fields pass the frontmatter whitelist', () => {
  const verdict = certify(fixture('claude-code-fields'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'frontmatter-field-whitelist');

  assert.equal(finding?.status, 'pass');
  assert.equal(verdict.status, 'pass');
});
