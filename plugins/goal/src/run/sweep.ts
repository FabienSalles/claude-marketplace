import { command } from '../adapters/command.ts';
import { fs } from '../adapters/fs.ts';
import { doneSection, gateFence } from '../core/plan.ts';
import { servicesOf } from '../core/rules/cross-iteration.ts';
import { REFUSED } from '../core/verdict.ts';
import { bounded, spawnOptions } from '../gate/bounded.ts';
import { declaredKeys, declaredPaths, iterationNumbers, iterationSection } from '../gate/plan.ts';
import { HaltError } from '../gate/halt.ts';
import { declaredServices } from '../gate/services.ts';
import type { Reporter } from './report.ts';

const DOD_GUIDANCE =
  '\nThe Definition of Done holds only invariants true on any intermediate base; a final-state check belongs in the `gate1` of the iteration that makes it true.';

type Line = { label: string; dod: boolean };

type Swept = [Line, string, Map<string, string>];

const swept = (block: string[], subject: string): Swept[] => {
  const declared = declaredKeys(block, subject);

  return [...declared].filter(([key]) => {
    if (/^dod[0-9]+$/.test(key)) {
      return true;
    }

    const gate = /^gate([0-9]+)$/.exec(key);

    return gate !== null && Number(gate[1]) >= 2;
  }).map(([key, command]) => [{ label: `${subject} ${key}`, dod: key.startsWith('dod') }, command, declared]);
};

const iterationsOf = (source: string): string[] => [
  ...new Set([...iterationNumbers(source, true), ...iterationNumbers(source, false)]),
];

const sweepCommands = (source: string): Swept[] => {
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
  const groups = new Map<string, { block: Map<string, string>; commands: Set<string> }>();
  let distinct = 0;

  for (const [, cmd, block] of keyed) {
    const path = pendingPath(cmd, pending);

    if (path !== undefined) {
      reporter.say(`RUN base sweep skipped \`${cmd}\`: ${path} is declared by the plan and not written yet`);
      continue;
    }

    const key = servicesOf(block);
    const group = groups.get(key) ?? { block, commands: new Set<string>() };

    group.commands.add(cmd);
    groups.set(key, group);
  }

  for (const { block, commands } of groups.values()) {
    const services = declaredServices(block);

    try {
      services.start();

      for (const cmd of commands) {
        distinct += 1;

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
    } catch (error) {
      if (error instanceof HaltError) {
        reporter.stop(`the base is not green: ${error.reason}\n${error.detail}`, REFUSED);
      }

      throw error;
    } finally {
      services.stop();
    }
  }

  reporter.say(
    `RUN base sweep: ${distinct} distinct command${distinct === 1 ? '' : 's'} run, ${declared.length} declared`,
  );
};
