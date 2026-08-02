// The base sweep the plan holds every iteration to: every gate/dod command it declares, run once
// per distinct command against the untouched tree rather than once per declaration — a
// six-iteration plan repeating the same commands across iterations sweeps 4 commands, not 15.

import { spawnSync } from 'node:child_process';

import { bounded } from '../gate/bounded.ts';
import type { Reporter } from './report.ts';

export const REFUSED = 2;

const sweepCommands = (source: string): string[] => {
  const commands: string[] = [];
  let inFence = false;

  for (const line of source.split('\n')) {
    if (line.trim() === '```gate') {
      inFence = true;
      continue;
    }

    if (line.trim() === '```') {
      inFence = false;
      continue;
    }

    if (!inFence) {
      continue;
    }

    const dod = /^dod[0-9]+=(.*)$/.exec(line);

    if (dod) {
      commands.push(dod[1]!);
      continue;
    }

    const gate = /^gate([0-9]+)=(.*)$/.exec(line);

    if (gate && Number(gate[1]) >= 2) {
      commands.push(gate[2]!);
    }
  }

  return commands;
};

export const sweep = (source: string, reporter: Reporter): void => {
  const declared = sweepCommands(source);
  const distinct = [...new Set(declared)];

  for (const cmd of distinct) {
    const result = spawnSync(bounded(cmd), { shell: true, encoding: 'utf8' });

    if (result.status !== 0) {
      reporter.stop(
        `the base is not green: \`${cmd}\` exited ${result.status} before this run wrote a line:\n${result.stdout}${result.stderr}`,
        REFUSED,
      );
    }
  }

  reporter.say(
    `RUN base sweep: ${distinct.length} distinct command${distinct.length === 1 ? '' : 's'} run, ${declared.length} declared`,
  );
};
