// Reading a plan: its hash, its sections, its gate blocks, the paths a block declares. Every
// rule below is stated against what this module returns, and nothing here decides anything.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { halt, misuse } from './halt.ts';

export const readPlan = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return misuse(`plan not readable: ${path}`);
  }
};

// A tick is the one edit an iteration is allowed to make to its own contract, so the
// hash is taken over the plan with every box unticked.
export const planHash = (source: string): string =>
  createHash('sha256').update(source.replace(/^- \[x\]/gm, '- [ ]')).digest('hex');

export const lockedHash = (
  plan: string,
  source: string,
  subject: string,
  locked: string | undefined,
): string => {
  const hash = planHash(source);

  if (locked !== undefined && locked !== hash) {
    halt(
      `The plan was modified during ${subject}, beyond ticking a box.`,
      `Locked normalized hash ${locked}\nFound            ${hash}\n\nThe executor rewrote its own contract. Review ${plan} and the last diff before resuming.`,
    );
  }

  return hash;
};

export const sectionBounds = (lines: string[], iteration: string): [number, number] => {
  const heading = new RegExp(`^### Iteration ${iteration}\\b`);
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) {
    halt(
      `The plan declares no iteration ${iteration}.`,
      `No "### Iteration ${iteration}" heading found.\n\nThe loop asked for an iteration the plan does not contain: either the plan was rewritten or the caller counted wrong. Nothing was run.`,
    );
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));

  return [start + 1, next === -1 ? lines.length : start + 1 + next];
};

export const iterationSection = (source: string, iteration: string): string[] => {
  const lines = source.split('\n');
  const [start, end] = sectionBounds(lines, iteration);

  return lines.slice(start, end);
};

export const gateBlock = (section: string[], subject: string): string[] => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  if (open === -1 || close === -1) {
    halt(
      `${subject} declares no gate block.`,
      'The iteration section holds no closed ```gate fence.\n\nAn iteration with no gate block has no acceptance criterion, no declared scope and no commit message, so nothing can be verified about it. The global Definition of Done block is not a substitute: it belongs to the plan, not to this slice.',
    );
  }

  return body.slice(0, close);
};

export const declaredKeys = (block: string[], subject: string): Map<string, string> => {
  const declared = new Map<string, string>();
  const twice: string[] = [];

  for (const line of block) {
    if (line.trim() === '') {
      continue;
    }

    const split = line.indexOf('=');
    const key = split === -1 ? line.trim() : line.slice(0, split).trim();

    if (declared.has(key)) {
      twice.push(key);
    }

    declared.set(key, split === -1 ? '' : line.slice(split + 1).trim());
  }

  if (twice.length > 0) {
    halt(
      `${subject} declares the same key twice.`,
      `Duplicated: ${twice.join(' ')}\n\nOne occurrence would silently win over the other, so the slice would be judged by a criterion nobody chose: a block carrying both gate1=true and gate1=false has no defined meaning. Keep one line per key.`,
    );
  }

  return declared;
};

export const declaredPaths = (declared: Map<string, string>): string[] =>
  ['test_files', 'impl_files']
    .flatMap((key) => (declared.get(key) ?? '').split(/\s+/))
    .filter((path) => path !== '');

export const covers = (entry: string, path: string): boolean =>
  entry === path || (entry.endsWith('/') && path.startsWith(entry));

// Generated tooling a project cannot help producing: a lockfile, a tsconfig, a CLI's own
// config file. Declared once for the whole plan rather than per iteration, because a lockfile
// moves on whichever slice happens to touch a dependency — a per-slice list is a prediction
// that is wrong by the next one, and the halt it produces refuses a complete implementation
// over a file nobody authored.
//
// Tolerated is not ignored: these paths are staged with the commit, since a tsconfig the gate
// waved through but left uncommitted turns the next iteration red on a file that is missing
// from the repository. They are deliberately kept out of max_diff — thousands of generated
// lockfile lines are not the slice's authored work, and counting them would make every budget
// meaningless.
export const incidentalPaths = (source: string): string[] =>
  (/^Incidental:(.*)$/m.exec(source)?.[1] ?? '').split(/\s+/).filter((path) => path !== '');

export const deliveryMode = (source: string): string =>
  /^Delivery mode:\s*allow-bc-break\s*$/m.test(source) ? 'allow-bc-break' : 'no-bc-break';

export const blockOf = (source: string, iteration: string): Map<string, string> =>
  declaredKeys(
    gateBlock(iterationSection(source, iteration), `Iteration ${iteration}`),
    `Iteration ${iteration}`,
  );

export const iterationNumbers = (source: string, ticked: boolean): string[] => {
  const lines = source.split('\n');
  const numbers: string[] = [];

  for (const line of lines) {
    const heading = /^### Iteration ([0-9]+)\b/.exec(line);

    if (heading === null) {
      continue;
    }

    const [start, end] = sectionBounds(lines, heading[1]!);
    const box = lines.slice(start, end).find((entry) => entry.startsWith('- ['));

    if (box?.startsWith(ticked ? '- [x]' : '- [ ]') === true) {
      numbers.push(heading[1]!);
    }
  }

  return numbers;
};
