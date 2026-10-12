import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const plugin = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(plugin, path), 'utf8');
const supervise = read('skills/supervise/SKILL.md');
const section = (heading: string): string =>
  new RegExp(`^## ${heading}\\n[\\s\\S]*?(?=\\n## |\\n# )`, 'm').exec(supervise)?.[0] ?? '';

test('R7 the host clause stops only a host with neither a shell nor an agent tool', () => {
  const block = section('Outside Claude Code');
  assert.match(block, /neither a shell nor an agent tool/);
  assert.doesNotMatch(block, /Claude Code only/);
});

test('R7 R9 the background shell and the agent call are named for both hosts', () => {
  const block = section('Outside Claude Code');
  assert.match(block, /background `Bash`/);
  assert.match(block, /`Agent`/);
  assert.match(block, /async `bash`[^\n]*`read_bash`/);
  assert.match(block, /`task`[^\n]*`goal:goal-session-auditor`/);
});

test('R8 the host never sets or unsets the provider settings', () => {
  assert.match(supervise, /never sets or unsets `GOAL_RUN_PROVIDER` or `GOAL_RUN_IMPLEMENTER`/i);
});

test('R11 a Copilot supervising session is read from its events', () => {
  assert.match(supervise, /~\/\.copilot\/session-state\/<id>\/events\.jsonl/);
  assert.match(supervise, /`session\.usage_record`/);
  assert.match(supervise, /`maxPromptTokens`/);
});

test('R11 a Copilot row costs premium requests or a dash, never a Claude price', () => {
  assert.match(supervise, /premium-request count or `—`/);
  assert.match(supervise, /never a Claude-priced figure/);
  assert.match(supervise, /`Total` names which rows its sums cover/);
});

test('R13 pinned supervise texts stay', () => {
  assert.match(supervise, /^# \/goal:supervise — Watch a run, classify a halt, repair or relaunch once$/m);
  assert.match(supervise, /### Session audit/);
  assert.match(supervise, /Unknown stops\./);
});

test('goal plugin 3.8.0 in both manifests', () => {
  const manifest = JSON.parse(read('.claude-plugin/plugin.json')) as { version: string };
  const market = JSON.parse(readFileSync(resolve(plugin, '../../.claude-plugin/marketplace.json'), 'utf8')) as {
    plugins: { name: string; version: string }[];
  };
  assert.equal(manifest.version, '3.8.0');
  assert.equal(market.plugins.find((p) => p.name === 'goal')?.version, '3.8.0');
});
