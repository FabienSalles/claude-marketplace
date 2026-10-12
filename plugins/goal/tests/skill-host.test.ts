import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const plugin = resolve(import.meta.dirname, '..');
const names = ['spec', 'plan', 'next', 'tickets', 'supervise', 'grill-adversarial'];
const read = (path: string): string => readFileSync(resolve(plugin, path), 'utf8');
const skill = (name: string): string => read(`skills/${name}/SKILL.md`);
const hostBlock = (source: string): string => /^## Host\n[\s\S]*?(?=\n## |\n# )/m.exec(source)?.[0] ?? '';

test('every goal skill carries the same Host block', () => {
  const blocks = names.map((name) => hostBlock(skill(name)));
  for (const [index, block] of blocks.entries()) {
    assert.notEqual(block, '', `${names[index]} has no Host block`);
    assert.equal(block, blocks[0], `${names[index]} Host block differs`);
  }
});

test('the Host block sits right after Portability, or after the frontmatter', () => {
  for (const name of names) {
    const source = skill(name);
    const headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    const expected = name === 'grill-adversarial' ? 0 : 1;
    assert.equal(headings[expected], 'Host', `${name} Host is not heading ${expected}`);
    if (name !== 'grill-adversarial') {
      assert.match(headings[0] ?? '',/^(Portability|Outside Claude Code)$/);
    }
  }
});

test('R1 R2 the block resolves the root and the argument when they stay literal', () => {
  const block = hostBlock(skill('spec'));
  assert.match(block, /Claude Code substitutes `\$\{CLAUDE_PLUGIN_ROOT\}` and `\$ARGUMENTS`/);
  assert.match(block, /Copilot CLI/);
  assert.match(block, /two levels above `Base directory for this skill:`/);
  assert.match(block, /text typed after the command \(empty when none\)/);
});

test('R5 the first output line names skill, host and manifest version', () => {
  const block = hostBlock(skill('spec'));
  assert.match(block, /`goal <skill> · <host> · v<version from <root>\/\.claude-plugin\/plugin\.json>`/);
});

test('R4 R6 a missing script root stops with the host and the install commands', () => {
  const block = hostBlock(skill('spec'));
  assert.match(block, /<root>\/src\/artifacts\.ts/);
  assert.match(block, /`cannot locate the goal plugin scripts`/);
  assert.match(block, /`copilot plugin marketplace add <repository>`/);
  assert.match(block, /`copilot plugin install goal@fabien-claude-marketplace`/);
  assert.match(block, /`\/plugin install goal@fabien-claude-marketplace`/);
  assert.match(block, /run nothing and write nothing/);
});

test('R15 a skill with no one to answer stops at its question', () => {
  assert.match(hostBlock(skill('spec')), /non-interactive[^\n]*stops at that question/);
});

test('R12 plan and next refuse manual mode under Copilot', () => {
  for (const name of ['plan', 'next']) {
    assert.match(skill(name), /Hosted in Copilot[^\n]*manual[^\n]*Claude Code's `\/goal`/, name);
  }
  assert.match(skill('plan'), /Hosted in Copilot, `manual` is not offered/);
  assert.match(skill('next'), /manual plan stops `\/goal:next`/);
});

test('R3 R4 README documents the Copilot install and its limit', () => {
  const readme = read('README.md');
  const section = /### Copilot hosts the goal sessions\n[\s\S]*?(?=\n##? |$)/.exec(readme)?.[0] ?? '';
  assert.notEqual(section, '');
  assert.match(section, /copilot plugin marketplace add FabienSalles\/claude-marketplace/);
  assert.match(section, /copilot plugin install goal@fabien-claude-marketplace/);
  assert.match(section, /live/i);
  assert.match(section, /manual/);
});
