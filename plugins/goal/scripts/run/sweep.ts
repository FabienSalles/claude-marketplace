// The base sweep the plan holds every iteration to: every gate/dod command it declares, run once
// per distinct command against the untouched tree rather than once per declaration — a
// six-iteration plan repeating the same commands across iterations sweeps 4 commands, not 15.
//
// What is declared is read from the blocks `gate/plan.ts` resolves for a real iteration or the
// plan's own Definition of Done, never from a ```gate fence scanned out of the raw text — a
// fence quoted in prose as a template or an example has no iteration section to belong to and
// stays unreachable.

import { spawnSync } from 'node:child_process';

import { doneSection, gateFence } from '../core/plan.ts';
import { bounded, spawnOptions } from '../gate/bounded.ts';
import { declaredKeys, iterationNumbers, iterationSection } from '../gate/plan.ts';
import type { Reporter } from './report.ts';

export const REFUSED = 2;

const swept = (block: string[], subject: string): string[] =>
  [...declaredKeys(block, subject)].filter(([key]) => {
    if (/^dod[0-9]+$/.test(key)) {
      return true;
    }

    const gate = /^gate([0-9]+)$/.exec(key);

    return gate !== null && Number(gate[1]) >= 2;
  }).map(([, command]) => command);

const sweepCommands = (source: string): string[] => {
  const numbers = [...new Set([...iterationNumbers(source, true), ...iterationNumbers(source, false)])];
  const iterations = numbers.flatMap((iteration) =>
    swept(gateFence(iterationSection(source, iteration)) ?? [], `Iteration ${iteration}`),
  );

  return [...iterations, ...swept(gateFence(doneSection(source) ?? []) ?? [], "the plan's Definition of Done")];
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
