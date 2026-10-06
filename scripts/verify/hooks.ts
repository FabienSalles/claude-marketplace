import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

import { pluginNames } from './manifests.ts';

const EVENTS: ReadonlySet<string> = new Set([
  'SessionStart',
  'Setup',
  'InstructionsLoaded',
  'UserPromptSubmit',
  'UserPromptExpansion',
  'MessageDisplay',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'PostToolBatch',
  'PermissionDenied',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'Stop',
  'StopFailure',
  'TeammateIdle',
  'ConfigChange',
  'CwdChanged',
  'DirectoryAdded',
  'FileChanged',
  'WorktreeCreate',
  'WorktreeRemove',
  'PreCompact',
  'PostCompact',
  'PreModelSwitch',
  'PostModelSwitch',
  'SessionEnd',
  'Elicitation',
  'ElicitationResult',
]);

const PLUGIN_ROOT = '${CLAUDE_PLUGIN_ROOT}/';

const EXACT_NAMES = /^[A-Za-z0-9_\- ,|]+$/;

const NARROW_EXACT_NAMES = /^[A-Za-z0-9_|]+$/;

const LITERAL_FILES_EVENT = 'FileChanged';

const NARROW_NAMES_EVENT = 'StopFailure';

const MARKDOWN_REFERENCE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"`']+)/g;

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

const items = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const matcherFinding = (event: string, matcher: unknown): string | undefined => {
  if (matcher === undefined || matcher === '' || matcher === '*') {
    return undefined;
  }

  if (typeof matcher !== 'string') {
    return `matcher ${JSON.stringify(matcher)} is not a string`;
  }

  if (event === LITERAL_FILES_EVENT || (event === NARROW_NAMES_EVENT ? NARROW_EXACT_NAMES : EXACT_NAMES).test(matcher)) {
    return undefined;
  }

  try {
    new RegExp(matcher);
  } catch {
    return `matcher "${matcher}" is not a valid regex`;
  }

  return matcher.startsWith('^') && matcher.endsWith('$')
    ? undefined
    : `matcher "${matcher}" is neither an exact-name list nor an anchored regex (^...$)`;
};

const insidePlugin = (pluginDir: string, path: string): boolean => {
  const inside = relative(pluginDir, path);

  return inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside);
};

const commandFindings = (pluginDir: string, plugin: string, command: string): readonly string[] =>
  command
    .replace(/["']/g, '')
    .trim()
    .split(/\s+/)
    .flatMap((word, index) => {
      if (!word.startsWith(PLUGIN_ROOT)) {
        return [];
      }

      const script = word.slice(PLUGIN_ROOT.length);
      const path = join(pluginDir, script);

      if (!insidePlugin(pluginDir, path)) {
        return [`runs ${script}, which is outside plugins/${plugin}`];
      }

      if (!existsSync(path)) {
        return [`runs ${script}, which does not exist under plugins/${plugin}`];
      }

      return index === 0 && (statSync(path).mode & 0o111) === 0
        ? [`runs ${script} without an interpreter, but it is not executable`]
        : [];
    });

const hookFindings = (root: string, plugin: string): readonly string[] => {
  const pluginDir = join(root, 'plugins', plugin);
  const file = join('plugins', plugin, 'hooks', 'hooks.json');

  if (!existsSync(join(root, file))) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch {
    return [`${file}: invalid JSON`];
  }

  const events = isRecord(parsed) && isRecord(parsed['hooks']) ? parsed['hooks'] : {};

  return Object.entries(events).flatMap(([event, matchers]) => [
    ...(EVENTS.has(event) ? [] : [`${file}: ${event} is not a documented Claude Code hook event`]),
    ...items(matchers).flatMap((group) => {
      const entry = isRecord(group) ? group : {};
      const matcher = matcherFinding(event, entry['matcher']);

      return [
        ...(matcher === undefined ? [] : [`${file}: ${event} ${matcher}`]),
        ...items(entry['hooks']).flatMap((handler) =>
          isRecord(handler) && handler['type'] === 'command' && typeof handler['command'] === 'string'
            ? commandFindings(pluginDir, plugin, handler['command']).map((finding) => `${file}: ${event} ${finding}`)
            : [],
        ),
      ];
    }),
  ]);
};

const markdownFindings = (root: string, plugin: string): readonly string[] => {
  const pluginDir = join(root, 'plugins', plugin);
  const commands = join(pluginDir, 'commands');

  if (!existsSync(commands)) {
    return [];
  }

  return readdirSync(commands)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .flatMap((name) =>
      [...readFileSync(join(commands, name), 'utf8').matchAll(MARKDOWN_REFERENCE)].flatMap((match) => {
        const target = (match[1] ?? '').replace(/[.,;:)]+$/, '');
        const where = `plugins/${plugin}/commands/${name}: \${CLAUDE_PLUGIN_ROOT}/${target}`;

        if (/<[^>]*>/.test(target)) {
          return [];
        }

        if (!insidePlugin(pluginDir, join(pluginDir, target))) {
          return [`${where} is outside plugins/${plugin}`];
        }

        return existsSync(join(pluginDir, target)) ? [] : [`${where} does not exist under plugins/${plugin}`];
      }),
    );
};

export const hookCommands = (root: string): readonly string[] =>
  pluginNames(root).flatMap((plugin) => [...hookFindings(root, plugin), ...markdownFindings(root, plugin)]);
