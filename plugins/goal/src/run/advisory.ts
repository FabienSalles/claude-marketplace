// The one preflight signal that never stops a run: an auto-updater left free to replace the
// Claude Code binary mid-iteration can kill it the same way the shutdown handling in quota.ts
// exists to survive. Missing, unreadable or invalid settings say nothing about that risk, so none
// of them raise the warning.

import { join } from 'node:path';

import { fs } from '../adapters/fs.ts';

export const defaultSettingsPath = (): string => process.env.GOAL_RUN_SETTINGS_PATH ?? join(fs.homeDir(), '.claude', 'settings.json');

export const autoUpdaterWarning = (path: string = defaultSettingsPath()): string | undefined => {
  let settings: Record<string, unknown>;

  try {
    const parsed: unknown = JSON.parse(fs.readFile(path));

    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    settings = parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const env = settings.env;
  const disabled = typeof env === 'object' && env !== null && 'DISABLE_AUTOUPDATER' in env;

  if (disabled || settings.autoUpdatesChannel === 'stable') {
    return undefined;
  }

  return `this machine's auto-updater can replace the Claude Code binary mid-run and kill it: set env.DISABLE_AUTOUPDATER or "autoUpdatesChannel": "stable" in ${path}. See the README.`;
};
