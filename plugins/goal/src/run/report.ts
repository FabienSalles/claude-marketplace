// The account every invocation of goal-run.ts leaves behind: every line declares whether the run
// is advancing or stopped, on stdout and, once a run directory is known, mirrored to a log file
// inside it.

import { join } from 'node:path';

import { fs } from '../adapters/fs.ts';

export type Reporter = {
  say: (message: string) => void;
  record: (text: string) => void;
  stop: (message: string, code: number) => never;
  setLog: (dir: string) => void;
  session?: (id: string) => void;
};

// One directory per launch, `.claude/goal-runs/<work-id>/<run-id>/`, created before anything is
// written into it. The run-id is the launch timestamp, so two launches of the same plan never
// collide, and pruning a finished work-id is one `rm -rf .claude/goal-runs/<work-id>/` rather than
// a search through `.claude/plans/` for whatever a run left beside the spec.
export const runDir = (workId: string): string => {
  const dir = join(process.cwd(), '.claude', 'goal-runs', workId, new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdir(dir, { recursive: true });

  return dir;
};

export const createReporter = (): Reporter => {
  let log = '';
  let jsonl = '';
  let sessionPath = '';

  // Bookkeeping, never the verdict's hostage: an unguarded throw out of say() exits 1, the code a
  // supervisor reads as a gate refusal and answers by discarding the implementer's tree.
  const append = (path: string, text: string): void => {
    try {
      fs.appendFile(path, text);
    } catch {
      // a lost line is not a lost run
    }
  };

  // The ingestible twin of the prose log: one versioned JSON line per call, alongside whatever
  // that call already rendered.
  const emit = (event: string, fields: Record<string, unknown>): void => {
    if (jsonl) {
      append(jsonl, `${JSON.stringify({ v: 1, ts: new Date().toISOString(), event, ...fields })}\n`);
    }
  };

  const say = (message: string): void => {
    process.stdout.write(`${message}\n`);

    if (log) {
      append(log, `${message}\n`);
      emit('say', { message });
    }
  };

  // An advisory agent's own words, kept out of stdout so the account there stays one state per
  // line, and into the run log, so a lens finding outlives the process that asked for it.
  const record = (text: string): void => {
    if (log && text.trim() !== '') {
      append(log, `${text}\n`);
      emit('record', { payload: text });
    }
  };

  const stop = (message: string, code: number): never => {
    const line = `STOP ${message}`;
    process.stdout.write(`${line}\n`);

    if (log) {
      append(log, `${line}\n`);
      emit('stop', { message: line, exit: code });
    }

    process.exit(code);
  };

  const setLog = (dir: string): void => {
    log = join(dir, '.run.log');
    jsonl = join(dir, '.run.jsonl');
    sessionPath = join(dir, '.run.session');
  };

  // Recorded beside the run's own log (`.run.log` -> `.run.session`, both in the run directory),
  // so a transcript already written to `~/.claude/projects/<encoded-path>/<session-id>.jsonl` can
  // be found later without correlating timestamps.
  const session = (id: string): void => {
    if (sessionPath) {
      append(sessionPath, `${id}\n`);
      emit('session', { payload: id });
    }
  };

  return { say, record, stop, setLog, session };
};
