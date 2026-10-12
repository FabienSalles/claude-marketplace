import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const plugin = resolve(import.meta.dirname, '..');
const names = ['spec', 'plan', 'next', 'tickets', 'supervise', 'grill-adversarial'];
const read = (path: string): string => readFileSync(resolve(plugin, path), 'utf8');
const skill = (name: string): string => read(`skills/${name}/SKILL.md`);
const hostBlock = (source: string): string => /^## Host\n[\s\S]*?(?=\n## |\n# )/m.exec(source)?.[0] ?? '';

const shared = read('shared/host.md');

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

test('R6 the bootstrap resolves the root and the argument when they stay literal', () => {
  const block = hostBlock(skill('spec'));
  assert.match(block, /`<root>` is Claude Code's substituted `\$\{CLAUDE_PLUGIN_ROOT\}`/);
  assert.match(block, /Copilot CLI/);
  assert.match(block, /two levels above `Base directory for this skill:`/);
  assert.match(block, /`\$ARGUMENTS`[^\n]*text typed after the command \(empty when none\)/);
  assert.match(block, /read `<root>\/shared\/host\.md`/);
});

test('R6 R9 a missing script root or shared file stops with the host and the install commands', () => {
  const block = hostBlock(skill('spec'));
  assert.match(block, /<root>\/src\/artifacts\.ts` or a shared file/);
  assert.match(block, /`cannot locate the goal plugin scripts`/);
  assert.match(block, /`copilot plugin marketplace add <repository>`/);
  assert.match(block, /`copilot plugin install goal@fabien-claude-marketplace`/);
  assert.match(block, /`\/plugin install goal@fabien-claude-marketplace`/);
  assert.match(block, /run nothing and write nothing/);
});

test('R7 shared files name <root>, never ${CLAUDE_PLUGIN_ROOT}', () => {
  for (const file of readdirSync(resolve(plugin, 'shared')).filter((entry) => entry.endsWith('.md'))) {
    assert.doesNotMatch(read(`shared/${file}`), /CLAUDE_PLUGIN_ROOT/, file);
  }
});

test('R8 the version line lives in shared/host.md and in no skill', () => {
  const line = /`goal <skill> · <host> · v<version from <root>\/\.claude-plugin\/plugin\.json>`/;
  assert.match(shared, line);
  for (const name of names) {
    assert.doesNotMatch(skill(name), /goal <skill> · <host>/, name);
  }
});

test('R2 the non-interactive stop lives in shared/host.md and in no skill', () => {
  assert.match(shared, /non-interactive[^\n]*stops at that question/);
  for (const name of names) {
    assert.doesNotMatch(skill(name), /non-interactive[^\n]*stops at that question/, name);
  }
});

test('R12 plan and next refuse manual mode under Copilot or Codex', () => {
  for (const name of ['plan', 'next']) {
    assert.match(skill(name), /Hosted in Copilot[^\n]*manual[^\n]*Claude Code's `\/goal`/, name);
  }
  assert.match(skill('plan'), /Hosted in Copilot or Codex, `manual` is not offered/);
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

test('R1 R2 the bootstrap derives the root from the SKILL.md a Codex host reads', () => {
  for (const name of names) {
    const block = hostBlock(skill(name));
    assert.match(block, /injects no base-directory line and reads `SKILL\.md` itself \(Codex CLI\) takes `<root>` as two levels\nabove that file's directory/, name);
  }
});

test('R3 shared/host.md names Codex CLI among the hosts', () => {
  assert.match(shared, /Codex CLI/);
});

test('R4 the stop gives the Codex install commands', () => {
  for (const name of names) {
    const block = hostBlock(skill(name));
    assert.match(block, /`codex plugin marketplace add <repository>`/, name);
    assert.match(block, /`codex plugin add goal@fabien-claude-marketplace`[^\n]*Codex/, name);
  }
});

test('R12 plan and next refuse manual mode under Codex too', () => {
  for (const name of ['plan', 'next']) {
    assert.match(skill(name), /Hosted in Copilot or Codex[^\n]*manual[^\n]*Claude Code's `\/goal`/, name);
  }
});

test('R13 the host rules name Codex user-input tool and keep the non-interactive stop', () => {
  assert.match(shared, /Codex[^\n]*request_user_input/);
  assert.match(shared, /non-interactive[^\n]*stops at that question/);
});

test('R5 README documents the Codex install, refresh, invocation and launch', () => {
  const readme = read('README.md');
  const section = /### Codex hosts the goal sessions\n[\s\S]*?(?=\n##? |$)/.exec(readme)?.[0] ?? '';
  assert.notEqual(section, '');
  assert.match(section, /codex plugin marketplace add FabienSalles\/claude-marketplace/);
  assert.match(section, /codex plugin add goal@fabien-claude-marketplace/);
  assert.match(section, /codex plugin marketplace upgrade[^\n]*Git marketplaces only/);
  assert.match(section, /re-running `codex plugin add goal@fabien-claude-marketplace`/);
  assert.match(section, /\$goal:spec|\$goal/);
  assert.match(section, /codex -s workspace-write -c sandbox_workspace_write\.network_access=true --add-dir "\$HOME\/\.claude"/);
});
