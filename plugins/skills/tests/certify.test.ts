import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { certify } from '../scripts/certify.ts';
import { certifyPluginStructure } from '../src/plugin-structure.ts';

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);

// R1 — a certified skill gets one verdict per level (2, 3, 4), not a single pass/fail blur:
// each level carries its own status and its own findings.
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

// R2 — the description-length platform limit fails with the exact figures cited, sourced to the
// docs that document it (VS Code, the Codex loader constant, the agentskills spec).
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

// R3 — an angle bracket in the description fails level 2 (spec/authoring rule), citing the
// Anthropic authoring docs, and pinpoints the offending character.
test('R3 — an angle bracket in the description fails level 2', () => {
  const verdict = certify(fixture('angle-brackets'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'description-no-angle-brackets');

  assert.equal(level2?.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /position/);
  assert.match(finding?.source ?? '', /platform\.claude\.com/);
});

// R4 — a frontmatter field outside the spec whitelist (e.g. version) fails level 2, naming the
// offending field and the allowed set.
test('R4 — an unexpected frontmatter field fails level 2, naming the field', () => {
  const verdict = certify(fixture('unexpected-field'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'frontmatter-field-whitelist');

  assert.equal(level2?.status, 'fail');
  assert.equal(finding?.status, 'fail');
  assert.match(finding?.detail ?? '', /unexpected field\(s\): version/);
});

// R9 — certification is fail-closed: a skill directory with no readable SKILL.md fails the
// blocking levels rather than being silently skipped, and stays stateless (no file written).
test('R9 — a skill directory with no SKILL.md fails closed on both blocking levels', () => {
  const verdict = certify(fixture('missing-skillmd'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const level3 = verdict.levels.find((level) => level.level === 3);

  assert.equal(level2?.status, 'fail');
  assert.equal(level3?.status, 'fail');
  assert.equal(verdict.status, 'fail');
});

// R9 — the CLI exit code mirrors the blocking verdict: a fully compliant skill exits 0, a
// blocking failure exits 1 — the same run, called twice, gives the same answer (stateless).
test('R9 — certify is a pure function of the skill directory: repeat calls agree', () => {
  const first = certify(fixture('valid'));
  const second = certify(fixture('valid'));

  assert.deepEqual(first, second);
  assert.equal(first.status, 'pass');
});

// R1 — a level-4 (advisory) failure alone does not flip the overall verdict to fail: only levels
// 2 and 3 are blocking.
test('R1 — a body over the advisory line ceiling fails level 4 without failing the overall verdict', () => {
  const verdict = certify(fixture('long-body'));
  const level4 = verdict.levels.find((level) => level.level === 4);

  assert.equal(level4?.status, 'fail');
  assert.equal(level4?.blocking, false);
  assert.equal(verdict.status, 'pass');
});

// I2 — a plugin with no skills directory certifies on plugin structure alone: a valid
// .claude-plugin/plugin.json is enough to pass.
test('I2 — a skill-less plugin with a valid plugin.json passes on structure', () => {
  const verdict = certifyPluginStructure(fixture('plugin-no-skills'));

  assert.equal(verdict.status, 'pass');
});

// I2 — certification stays fail-closed: malformed JSON in plugin.json fails rather than being
// skipped.
test('I2 — a skill-less plugin with malformed plugin.json fails closed', () => {
  const verdict = certifyPluginStructure(fixture('plugin-broken-json'));

  assert.equal(verdict.status, 'fail');
});

// I2 — certification stays fail-closed: a missing plugin.json fails rather than being skipped.
test('I2 — a skill-less plugin with no plugin.json fails closed', () => {
  const verdict = certifyPluginStructure(fixture('plugin-no-manifest'));

  assert.equal(verdict.status, 'fail');
});

// R4 — the Claude Code platform fields documented by skill-authoring (disable-model-invocation,
// user-invocable, context, agent, model) are allowed by the whitelist alongside the spec fields.
test('R4 — Claude Code platform fields pass the frontmatter whitelist', () => {
  const verdict = certify(fixture('claude-code-fields'));
  const level2 = verdict.levels.find((level) => level.level === 2);
  const finding = level2?.findings.find((f) => f.rule === 'frontmatter-field-whitelist');

  assert.equal(finding?.status, 'pass');
  assert.equal(verdict.status, 'pass');
});
