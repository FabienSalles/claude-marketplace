import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const plugin = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(plugin, path), 'utf8');
const supervise = read('skills/supervise/SKILL.md');
const section = (heading: string): string =>
  new RegExp(`^## ${heading}\\n[\\s\\S]*?(?=\\n## |\\n# )`, 'm').exec(supervise)?.[0] ?? '';

const codexBlock = section('Under Codex');

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

test('goal plugin 3.9.2 in both manifests', () => {
  const manifest = JSON.parse(read('.claude-plugin/plugin.json')) as { version: string };
  const market = JSON.parse(readFileSync(resolve(plugin, '../../.claude-plugin/marketplace.json'), 'utf8')) as {
    plugins: { name: string; version: string }[];
  };
  assert.equal(manifest.version, '3.9.2');
  assert.equal(market.plugins.find((p) => p.name === 'goal')?.version, '3.9.2');
});

test('R6 the Codex host never sets the provider or the implementer', () => {
  assert.match(codexBlock, /Claude stays the implementer/);
  assert.match(codexBlock, /never sets or unsets `GOAL_RUN_PROVIDER` or `GOAL_RUN_IMPLEMENTER`/);
  assert.match(codexBlock, /`exec_command`[^\n]*`write_stdin`/);
});

test('R7 network and writes are probed before launching, and a failure launches nothing', () => {
  assert.match(codexBlock, /network probe/);
  assert.match(codexBlock, /write probe into `\$HOME\/\.claude`/);
  assert.match(
    codexBlock,
    /codex -s workspace-write -c sandbox_workspace_write\.network_access=true --add-dir "\$HOME\/\.claude"/,
  );
  assert.match(codexBlock, /launch nothing/);
});

test('R8 Phase 7 audits through claude -p under Codex', () => {
  assert.match(codexBlock, /claude -p --agent goal:goal-session-auditor/);
  assert.match(codexBlock, /no agent tool/);
});

test('R9 a failed claude -p audit is reported with its error and folds nothing', () => {
  assert.match(codexBlock, /failed audit is reported with its error/);
  assert.match(codexBlock, /folds no `### Session audit`/);
});

test('R11 the Codex supervising row reads token_usage_record once per response_id', () => {
  assert.match(codexBlock, /`token_usage_record\.payload\.usage` once per `response_id`/);
  assert.match(codexBlock, /`input_tokens` minus `cached_input_tokens`/);
  assert.match(codexBlock, /`cache_write_input_tokens`/);
  assert.match(codexBlock, /`model_context_window`[^\n]*`event_msg`[^\n]*`token_count`/);
  assert.match(codexBlock, /cost `—`/);
  assert.match(codexBlock, /`Total` names which rows/);
});

test('R7 the host-tools paragraph names the three hosts with their tools', () => {
  const block = section('Outside Claude Code');
  assert.match(block, /Claude Code: background `Bash`, `Agent`/);
  assert.match(block, /Copilot CLI: async `bash`/);
  assert.match(block, /Codex CLI: `exec_command` read with `write_stdin`/);
});

test('R8 the pinned probes are given verbatim and a failure names the probe', () => {
  assert.ok(codexBlock.includes(`curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://api.github.com`));
  assert.ok(
    codexBlock.includes(
      `curl -s -o /dev/null -w '%{http_code}' --max-time 10 "\${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"`,
    ),
  );
  assert.ok(codexBlock.includes(`f="$HOME/.claude/.goal-write-probe-$$" && touch "$f" && rm -f "$f"`));
  assert.match(codexBlock, /other than `000`/);
  assert.match(codexBlock, /name the failing probe/);
});
