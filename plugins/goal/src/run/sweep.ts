import { command } from '../adapters/command.ts';
import { fs } from '../adapters/fs.ts';
import { doneSection, gateFence } from '../core/plan.ts';
import { REFUSED } from '../core/verdict.ts';
import { bounded, spawnOptions } from '../gate/bounded.ts';
import { declaredKeys, declaredPaths, iterationNumbers, iterationSection } from '../gate/plan.ts';
import type { Reporter } from './report.ts';

const DOD_GUIDANCE =
  '\nThe Definition of Done holds only invariants true on any intermediate base; a final-state check belongs in the `gate1` of the iteration that makes it true.';

type Line = { label: string; dod: boolean };

const swept = (block: string[], subject: string): [Line, string][] =>
  [...declaredKeys(block, subject)].filter(([key]) => {
    if (/^dod[0-9]+$/.test(key)) {
      return true;
    }

    const gate = /^gate([0-9]+)$/.exec(key);

    return gate !== null && Number(gate[1]) >= 2;
  }).map(([key, command]) => [{ label: `${subject} ${key}`, dod: key.startsWith('dod') }, command]);

const iterationsOf = (source: string): string[] => [
  ...new Set([...iterationNumbers(source, true), ...iterationNumbers(source, false)]),
];

const sweepCommands = (source: string): [Line, string][] => {
  const iterations = iterationsOf(source).flatMap((iteration) =>
    swept(gateFence(iterationSection(source, iteration)) ?? [], `Iteration ${iteration}`),
  );

  return [...iterations, ...swept(gateFence(doneSection(source) ?? []) ?? [], "the plan's Definition of Done")];
};

const notWrittenYet = (source: string): Set<string> =>
  new Set(
    iterationsOf(source)
      .flatMap((iteration) =>
        declaredPaths(declaredKeys(gateFence(iterationSection(source, iteration)) ?? [], `Iteration ${iteration}`)),
      )
      .filter((path) => !fs.exists(path)),
  );

const pendingPath = (cmd: string, pending: Set<string>): string | undefined =>
  cmd
    .split(/\s+/)
    .map((token) => token.replace(/^\.\//, ''))
    .find((token) => pending.has(token));

export const sweep = (source: string, reporter: Reporter): void => {
  const keyed = sweepCommands(source);
  const declared = keyed.map(([, cmd]) => cmd);
  const pending = notWrittenYet(source);
  const distinct = [...new Set(declared)].filter((cmd) => {
    const path = pendingPath(cmd, pending);

    if (path === undefined) {
      return true;
    }

    reporter.say(`RUN base sweep skipped \`${cmd}\`: ${path} is declared by the plan and not written yet`);

    return false;
  });

  for (const cmd of distinct) {
    const result = command.run(bounded(cmd), [], spawnOptions());

    if (result.status !== 0) {
      const lines = keyed.filter(([, declaredCmd]) => declaredCmd === cmd).map(([line]) => line);
      const guidance = lines.some((line) => line.dod) ? DOD_GUIDANCE : '';

      reporter.stop(
        `the base is not green: \`${cmd}\` exited ${result.status} before this run wrote a line:\n${result.stdout}${result.stderr}\ndeclared by: ${lines.map((line) => line.label).join(', ')}${guidance}`,
        REFUSED,
      );
    }
  }

  reporter.say(
    `RUN base sweep: ${distinct.length} distinct command${distinct.length === 1 ? '' : 's'} run, ${declared.length} declared`,
  );
};
