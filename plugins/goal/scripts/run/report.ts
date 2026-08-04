// The account every invocation of goal-run.ts leaves behind: every line declares whether the run
// is advancing or stopped, on stdout and, once a plan is known, mirrored to a log file beside it.

import { appendFileSync } from 'node:fs';

export type Reporter = {
  say: (message: string) => void;
  record: (text: string) => void;
  stop: (message: string, code: number) => never;
  setLog: (path: string) => void;
  session?: (id: string) => void;
};

export const createReporter = (): Reporter => {
  let log = '';
  let jsonl = '';

  // The ingestible twin of the prose log: one versioned JSON line per call, alongside whatever
  // that call already rendered.
  const emit = (event: string, fields: Record<string, unknown>): void => {
    if (jsonl) {
      appendFileSync(jsonl, `${JSON.stringify({ v: 1, ts: new Date().toISOString(), event, ...fields })}\n`);
    }
  };

  const say = (message: string): void => {
    process.stdout.write(`${message}\n`);

    if (log) {
      appendFileSync(log, `${message}\n`);
      emit('say', { message });
    }
  };

  // An advisory agent's own words, kept out of stdout so the account there stays one state per
  // line, and into the run log, so a lens finding outlives the process that asked for it.
  const record = (text: string): void => {
    if (log && text.trim() !== '') {
      appendFileSync(log, `${text}\n`);
      emit('record', { payload: text });
    }
  };

  const stop = (message: string, code: number): never => {
    const line = `STOP ${message}`;
    process.stdout.write(`${line}\n`);

    if (log) {
      appendFileSync(log, `${line}\n`);
      emit('stop', { message: line, exit: code });
    }

    process.exit(code);
  };

  const setLog = (path: string): void => {
    log = path;
    jsonl = path.replace(/\.log$/, '.jsonl');
  };

  // Recorded beside the run's own log (`<plan>.run.log` -> `<plan>.run.session`), so a
  // transcript already written to `~/.claude/projects/<encoded-path>/<session-id>.jsonl` can be
  // found later without correlating timestamps.
  const session = (id: string): void => {
    if (log) {
      appendFileSync(log.replace(/\.log$/, '.session'), `${id}\n`);
      emit('session', { payload: id });
    }
  };

  return { say, record, stop, setLog, session };
};
