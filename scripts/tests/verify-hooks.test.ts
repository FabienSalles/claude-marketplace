import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hookCommands } from '../verify/hooks.ts';

type Hooks = Record<string, readonly { readonly matcher?: string; readonly hooks: readonly { readonly type: string; readonly command?: string }[] }[]>;

const plugin = (hooks: Hooks, commands: Readonly<Record<string, string>> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'verify-hooks-'));
  const dir = join(root, 'plugins', 'demo');
  mkdirSync(join(dir, 'hooks'), { recursive: true });
  mkdirSync(join(dir, 'commands'), { recursive: true });
  writeFileSync(join(dir, 'hooks', 'hooks.json'), JSON.stringify({ hooks }));
  writeFileSync(join(dir, 'hooks', 'run.sh'), '#!/bin/bash\n');
  chmodSync(join(dir, 'hooks', 'run.sh'), 0o755);
  writeFileSync(join(dir, 'hooks', 'plain.sh'), '#!/bin/bash\n');
  chmodSync(join(dir, 'hooks', 'plain.sh'), 0o644);

  for (const [name, text] of Object.entries(commands)) {
    writeFileSync(join(dir, 'commands', name), text);
  }

  return root;
};

const findings = (hooks: Hooks, commands: Readonly<Record<string, string>> = {}): readonly string[] => {
  const root = plugin(hooks, commands);

  try {
    return hookCommands(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const command = (text: string, matcher = 'Bash') => [{ matcher, hooks: [{ type: 'command', command: text }] }];

test('quoted commands on documented events with exact-name matchers raise no finding', () => {
  assert.deepEqual(
    findings({
      PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', 'Write|Edit'),
      PostToolUse: command('bash "${CLAUDE_PLUGIN_ROOT}/hooks/plain.sh"', '^Notebook.*$'),
      Stop: [{ hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh" stop' }] }],
    }),
    [],
  );
});

test('an event Claude Code does not document is named', () => {
  assert.deepEqual(findings({ PreToolUze: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"') }), [
    'plugins/demo/hooks/hooks.json: PreToolUze is not a documented Claude Code hook event',
  ]);
});

test('a matcher that is neither an exact-name list nor an anchored regex is named', () => {
  assert.deepEqual(findings({ PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', 'Edit.*') }), [
    'plugins/demo/hooks/hooks.json: PreToolUse matcher "Edit.*" is neither an exact-name list nor an anchored regex (^...$)',
  ]);
  assert.deepEqual(findings({ PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', '^(Edit$') }), [
    'plugins/demo/hooks/hooks.json: PreToolUse matcher "^(Edit$" is not a valid regex',
  ]);
});

test('a command naming a script missing from its plugin is named', () => {
  assert.deepEqual(findings({ PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/hooks/gone.sh"') }), [
    'plugins/demo/hooks/hooks.json: PreToolUse runs hooks/gone.sh, which does not exist under plugins/demo',
  ]);
});

test('a script run without an interpreter must be executable; one run by an interpreter need not be', () => {
  assert.deepEqual(findings({ PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/hooks/plain.sh"') }), [
    'plugins/demo/hooks/hooks.json: PreToolUse runs hooks/plain.sh without an interpreter, but it is not executable',
  ]);
  assert.deepEqual(findings({ PreToolUse: command('bash "${CLAUDE_PLUGIN_ROOT}/hooks/plain.sh"') }), []);
});

test('a plugin-root reference in a command file must resolve, a placeholder path is skipped', () => {
  assert.deepEqual(
    findings(
      {},
      {
        'ok.md': 'Run `${CLAUDE_PLUGIN_ROOT}/hooks/run.sh`, or ${CLAUDE_PLUGIN_ROOT}/hooks/plain.sh, then write `${CLAUDE_PLUGIN_ROOT}/out/<name>.md`.',
        'broken.md': 'Read `${CLAUDE_PLUGIN_ROOT}/templates/gone.md`, first.',
      },
    ),
    ['plugins/demo/commands/broken.md: ${CLAUDE_PLUGIN_ROOT}/templates/gone.md does not exist under plugins/demo'],
  );
});

test('a plugin-root reference in prose ends at the line end and drops trailing punctuation', () => {
  assert.deepEqual(
    findings(
      {},
      {
        'prose.md':
          'Run ${CLAUDE_PLUGIN_ROOT}/hooks/run.sh\nthen continue.\nSee ${CLAUDE_PLUGIN_ROOT}/hooks/run.sh.\n(or ${CLAUDE_PLUGIN_ROOT}/hooks/plain.sh); then ${CLAUDE_PLUGIN_ROOT}/hooks/run.sh:\n',
      },
    ),
    [],
  );
});

test('a command or a reference that leaves its plugin is named, even when the path exists in the repository', () => {
  const root = plugin(
    { PreToolUse: command('"${CLAUDE_PLUGIN_ROOT}/../other/hooks/run.sh"') },
    { 'leave.md': 'Run `${CLAUDE_PLUGIN_ROOT}/../other/hooks/run.sh`.' },
  );

  try {
    mkdirSync(join(root, 'plugins', 'other', 'hooks'), { recursive: true });
    writeFileSync(join(root, 'plugins', 'other', 'hooks', 'run.sh'), '#!/bin/bash\n');
    chmodSync(join(root, 'plugins', 'other', 'hooks', 'run.sh'), 0o755);

    assert.deepEqual(hookCommands(root), [
      'plugins/demo/hooks/hooks.json: PreToolUse runs ../other/hooks/run.sh, which is outside plugins/demo',
      'plugins/demo/commands/leave.md: ${CLAUDE_PLUGIN_ROOT}/../other/hooks/run.sh is outside plugins/demo',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a FileChanged matcher lists literal file names and is not judged as a regex', () => {
  assert.deepEqual(findings({ FileChanged: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', '.envrc|.env') }), []);
});

test('a StopFailure matcher is an exact-name list only with letters, digits, _ and |, as Claude Code reads it', () => {
  assert.deepEqual(findings({ StopFailure: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', 'rate_limit|overloaded') }), []);
  assert.deepEqual(findings({ StopFailure: command('"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh"', 'rate_limit, overloaded') }), [
    'plugins/demo/hooks/hooks.json: StopFailure matcher "rate_limit, overloaded" is neither an exact-name list nor an anchored regex (^...$)',
  ]);
});
