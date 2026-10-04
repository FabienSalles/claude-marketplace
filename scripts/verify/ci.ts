import type { Check } from './ports.ts';

export const forCi = (checks: readonly Check[], env: NodeJS.ProcessEnv): readonly Check[] => {
  if (env['GITHUB_ACTIONS'] !== 'true') {
    return checks;
  }

  const pullRequest = env['GITHUB_EVENT_NAME'] === 'pull_request';

  return checks.flatMap((check): readonly Check[] => {
    if (!('command' in check)) {
      return [check];
    }

    if (check.command.includes('--diff')) {
      return pullRequest ? [check] : [];
    }

    return check.command[0] === './scripts/health-check.sh'
      ? [{ ...check, command: check.command.filter((word) => word !== '--quick') }]
      : [check];
  });
};
