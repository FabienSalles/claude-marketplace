import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const runner = [
  ...readdirSync(join(root, 'src', 'run')).filter((file) => file.endsWith('.ts')).map((file) => join('src', 'run', file)),
  join('src', 'core', 'events.ts'),
  join('scripts', 'goal-run.ts'),
];

const adapterImport = /^import .* from '\.\.\/src\/adapters\/claude\/(?:session|warning|postmortem)\.ts';$/;

const CLAUDE_TOKENS: [string, RegExp, string][] = [
  ['the claude binary', /['"`]claude['"`]/, "spawn('claude'"],
  ['--agent', /--agent\b/, 'x --agent y'],
  ['--permission-mode', /--permission-mode/, '--permission-mode'],
  ['--output-format', /--output-format/, '--output-format'],
  ['stream-json', /stream-json/, 'stream-json'],
  ['~/.claude', /~\/\.claude/, '~/.claude/projects'],
  ['DISABLE_AUTOUPDATER', /DISABLE_AUTOUPDATER/, "DISABLE_AUTOUPDATER: '1'"],
  ['a goal-run agent id', /goal:goal-run-/, "'goal:goal-run-lens'"],
];

const leaks = (file: string): string[] =>
  readFileSync(join(root, file), 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      adapterImport.test(line) ? [] : CLAUDE_TOKENS.filter(([, pattern]) => pattern.test(line)).map(([name]) => `${file}:${index + 1} names ${name}`),
    );

// R9 — nothing Claude-specific remains in the runner outside Claude's adapter.
test('no runner module outside the adapter names a Claude binary, flag, event shape or home directory', () => {
  assert.deepEqual(runner.flatMap(leaks), []);
});

// R9 — the guard fails when a token reappears.
test('the provider-neutral guard recognises each Claude token it forbids', () => {
  for (const [name, pattern, sample] of CLAUDE_TOKENS) {
    assert.ok(pattern.test(sample), name);
  }
});
