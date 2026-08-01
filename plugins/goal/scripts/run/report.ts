// The account every invocation of goal-run.ts leaves behind: every line declares whether the run
// is advancing or stopped, on stdout and, once a plan is known, mirrored to a log file beside it.

import { appendFileSync } from 'node:fs';

export type Reporter = {
  say: (message: string) => void;
  stop: (message: string, code: number) => never;
  setLog: (path: string) => void;
};

export const createReporter = (): Reporter => {
  let log = '';

  const say = (message: string): void => {
    process.stdout.write(`${message}\n`);

    if (log) {
      appendFileSync(log, `${message}\n`);
    }
  };

  const stop = (message: string, code: number): never => {
    say(`STOP ${message}`);
    process.exit(code);
  };

  const setLog = (path: string): void => {
    log = path;
  };

  return { say, stop, setLog };
};
