import type { Check } from './ports.ts';

const WALL = '--wall';

const withoutWallCeiling = (check: Check): Check => {
  if (!('command' in check) || !check.command.includes(WALL)) {
    return check;
  }

  const at = check.command.indexOf(WALL);

  return { ...check, command: [...check.command.slice(0, at), ...check.command.slice(at + 2)] };
};

export const forCi = (checks: readonly Check[], env: NodeJS.ProcessEnv): readonly Check[] =>
  env['GITHUB_ACTIONS'] === 'true' ? checks : checks.map(withoutWallCeiling);
