// The base sweep the plan holds every iteration to: every gate/dod command it declares, run once
// per distinct command against the untouched tree rather than once per declaration — a
// six-iteration plan repeating the same commands across iterations sweeps 4 commands, not 15.
//
// What is declared is read from the blocks `gate/plan.ts` resolves for a real iteration or the
// plan's own Definition of Done, never from a ```gate fence scanned out of the raw text — a
// fence quoted in prose as a template or an example has no iteration section to belong to and
// stays unreachable.

import { spawnSync } from 'node:child_process';

import { bounded, spawnOptions } from '../gate/bounded.ts';
import { declaredKeys, iterationNumbers, iterationSection } from '../gate/plan.ts';
import type { Reporter } from './report.ts';

export const REFUSED = 2;

// The same fence `gate/plan.ts`'s `gateBlock` looks for, but tolerant of a section carrying
// none: an iteration not yet fleshed out, or the plan's own Definition of Done heading with
// nothing under it, sweeps as zero commands rather than halting the run over a slice this sweep
// was never asked to judge.
const fenceIn = (section: string[]): string[] => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  return open === -1 || close === -1 ? [] : body.slice(0, close);
};

const swept = (block: string[], subject: string): string[] =>
  [...declaredKeys(block, subject)].filter(([key]) => {
    if (/^dod[0-9]+$/.test(key)) {
      return true;
    }

    const gate = /^gate([0-9]+)$/.exec(key);

    return gate !== null && Number(gate[1]) >= 2;
  }).map(([, command]) => command);

// The same "## Definition of Done" heading and section boundary `gate/ship.ts:17` locates.
const doneSection = (source: string): string[] => {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^## Definition of Done\b/.test(line));

  if (start === -1) {
    return [];
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));

  return lines.slice(start + 1, next === -1 ? lines.length : start + 1 + next);
};

const sweepCommands = (source: string): string[] => {
  const numbers = [...new Set([...iterationNumbers(source, true), ...iterationNumbers(source, false)])];
  const iterations = numbers.flatMap((iteration) =>
    swept(fenceIn(iterationSection(source, iteration)), `Iteration ${iteration}`),
  );

  return [...iterations, ...swept(fenceIn(doneSection(source)), "the plan's Definition of Done")];
};

export const sweep = (source: string, reporter: Reporter): void => {
  const declared = sweepCommands(source);
  const distinct = [...new Set(declared)];

  for (const cmd of distinct) {
    const result = spawnSync(bounded(cmd), spawnOptions());

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
