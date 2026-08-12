// The plan's construction invariants, proven without a process to exit or a filesystem to read:
// given what gate/plan.ts already parsed out of the markdown, a Plan exists only when every one
// of these rules holds. gate/plan.ts is the sole adapter that reads a file and calls makePlan;
// everything below takes values in and hands a value back.

import { basename } from 'node:path';

import { err, ok, type Result } from './result.ts';
import { halt, type Halt } from './verdict.ts';

export type DeliveryMode = 'allow-bc-break' | 'no-bc-break';

export type Plan = {
  readonly iteration: string;
  readonly declared: ReadonlyMap<string, string>;
  readonly testFiles: readonly string[];
  readonly implFiles: readonly string[];
  readonly incidental: readonly string[];
  readonly maxDiff: number | undefined;
  readonly deliveryMode: DeliveryMode;
};

const ALLOWED_KEY = /^(test_files|impl_files|max_diff|commit_msg|gate[1-9][0-9]*)$/;
const REQUIRED_KEYS = ['gate1', 'impl_files', 'commit_msg'] as const;

// Anchored on a path segment, duplicated from gate/never.ts on purpose: that module sits outside
// this iteration's declared files, and a plan naming a secret must be refused before any tree
// exists to scan it against — not only once the tree-scanning check runs downstream.
const NEVER_VERSIONED = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$|sample$|template$|dist$)/,
  /(^|\/)node_modules\//,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.(pem|p12|pfx|jks|keystore)$/,
];

const split = (value: string | undefined): string[] =>
  (value ?? '').split(/\s+/).filter((path) => path !== '');

export const covers = (entry: string, path: string): boolean =>
  entry === path || (entry.endsWith('/') && path.startsWith(entry));

const legalKeys = (declared: ReadonlyMap<string, string>, iteration: string): Halt | undefined => {
  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_KEY.test(key));

  if (forbidden.length > 0) {
    return halt(
      `Iteration ${iteration} declares a key it may not set.`,
      `Refused: ${forbidden.join(' ')}\n\nAn iteration gate block sets only test_files, impl_files, max_diff, commit_msg and gate1..N. Any other key either belongs to the run rather than the slice — the plan hash, the global DoD, whether anything ships — or is not a key at all. A slice that could set them would be rewriting the terms it is judged by.`,
    );
  }

  const missing = REQUIRED_KEYS.filter((key) => (declared.get(key) ?? '') === '');

  if (missing.length > 0) {
    return halt(
      `Iteration ${iteration} is not runnable unattended.`,
      `Missing or empty: ${missing.join(' ')}\n\ngate1 is the acceptance criterion — without it the iteration exits 0 having proved nothing, which is exactly what the loop must never advance on. impl_files is the reference the scope check is made against. commit_msg is the message the slice is committed under. Write them into the gate block, or halt and report that this slice cannot be verified unattended.`,
    );
  }

  return undefined;
};

const noOverlap = (
  testFiles: readonly string[],
  implFiles: readonly string[],
  iteration: string,
): Halt | undefined => {
  if (testFiles.length === 0) {
    return undefined;
  }

  const overlapping = new Set<string>();
  const pairs: string[] = [];

  for (const impl of implFiles) {
    for (const path of testFiles) {
      if (covers(impl, path)) {
        pairs.push(`${impl} covers ${path}`);
        overlapping.add(impl);
      }
    }
  }

  if (pairs.length === 0) {
    return undefined;
  }

  const fix = implFiles.filter((impl) => !overlapping.has(impl));

  return halt(
    `Iteration ${iteration} declares impl_files that covers its own test_files.`,
    `Overlapping: ${pairs.join(', ')}\n\nA bite check sets impl_files aside and reruns gate1: an impl_files path that also covers the test removes the test along with the implementation, so gate1 cannot fail for the right reason. Declare impl_files as: ${fix.join(' ') || '(none — every declared impl file covers a test)'}`,
  );
};

const shapedPaths = (paths: readonly string[], iteration: string): Halt | undefined => {
  const unusable = paths.filter((path) => /[`()*?[\]]/.test(path));

  if (unusable.length === 0) {
    return undefined;
  }

  return halt(
    `Iteration ${iteration} does not declare a list of paths.`,
    `Unusable: ${unusable.join(' ')}\n\ntest_files and impl_files hold bare, space-separated, repo-relative paths and nothing else: no glob, no backtick, no markdown annotation. A whole subtree is declared by a trailing slash (plugins/goal/).`,
  );
};

const declaredSecrets = (paths: readonly string[], iteration: string): Halt | undefined => {
  const refused = [...new Set(paths)].filter((path) => NEVER_VERSIONED.some((pattern) => pattern.test(path)));

  if (refused.length === 0) {
    return undefined;
  }

  return halt(
    `Iteration ${iteration} would version a file that must never be committed.`,
    `Refused: ${refused.join(' ')}\n\nThese paths carry credentials or vendored dependencies, so no declaration makes them committable, whatever the gate block says. Add them to .gitignore. If one is already committed, treat whatever it holds as disclosed and rotate it: a later deletion does not remove it from history.`,
  );
};

const numericMaxDiff = (declared: ReadonlyMap<string, string>, iteration: string): Result<number | undefined, Halt> => {
  const budget = declared.get('max_diff') ?? '';

  if (budget === '') {
    return ok(undefined);
  }

  if (!/^[0-9]+$/.test(budget)) {
    return err(
      halt(
        `Iteration ${iteration} declares a max_diff that is not a number.`,
        `Found: ${budget}\n\nA budget nothing can compare against is a budget nobody is held to: the slice would run unbounded while the plan claims otherwise. Write a plain line count.`,
      ),
    );
  }

  return ok(Number(budget));
};

export const makePlan = (
  iteration: string,
  declared: ReadonlyMap<string, string>,
  incidental: readonly string[] = [],
  deliveryMode: DeliveryMode = 'no-bc-break',
): Result<Plan, Halt> => {
  const testFiles = split(declared.get('test_files'));
  const implFiles = split(declared.get('impl_files'));
  const allPaths = [...testFiles, ...implFiles, ...incidental];

  const refusal =
    legalKeys(declared, iteration) ??
    noOverlap(testFiles, implFiles, iteration) ??
    shapedPaths(allPaths, iteration) ??
    declaredSecrets(allPaths, iteration);

  if (refusal !== undefined) {
    return err(refusal);
  }

  const maxDiff = numericMaxDiff(declared, iteration);

  if (!maxDiff.ok) {
    return maxDiff;
  }

  return ok(
    Object.freeze({
      iteration,
      declared,
      testFiles: Object.freeze(testFiles),
      implFiles: Object.freeze(implFiles),
      incidental: Object.freeze([...incidental]),
      maxDiff: maxDiff.value,
      deliveryMode,
    }),
  );
};

// A plan's work-id from its filename: everything before the -spec.md / -cleanup-spec.md suffix,
// or before .md when neither applies. Every consumer that names a run's own directory or checks
// the branch a plan expects reads it from here rather than repeating the suffix stripping.
export const workIdOf = (plan: string): string => {
  const base = basename(plan);

  if (base.endsWith('-cleanup-spec.md')) {
    return base.slice(0, -'-cleanup-spec.md'.length);
  }

  if (base.endsWith('-spec.md')) {
    return base.slice(0, -'-spec.md'.length);
  }

  return base.replace(/\.md$/, '');
};

// The bounds of an iteration's own section — from just after its "### Iteration N" heading to the
// next "##"/"###" heading — undefined when the plan declares no such iteration. Distinct from
// gate/plan.ts's sectionBounds, which halts on the same absence: a caller building a pull request
// body from whichever iterations already landed needs to read past one the plan never had.
export const iterationBounds = (lines: readonly string[], iteration: string): [number, number] | undefined => {
  const heading = new RegExp(`^### Iteration ${iteration}\\b`);
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) {
    return undefined;
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));

  return [start + 1, next === -1 ? lines.length : start + 1 + next];
};

// The "## Definition of Done" section, boundary-matched the same way — undefined when the plan
// declares none.
export const doneSection = (source: string): string[] | undefined => {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^## Definition of Done\b/.test(line));

  if (start === -1) {
    return undefined;
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));

  return lines.slice(start + 1, next === -1 ? lines.length : start + 1 + next);
};

// The ```gate fence inside a resolved section, tolerant of a section carrying none — an iteration
// not yet fleshed out, or a heading with nothing under it.
export const gateFence = (section: readonly string[]): string[] | undefined => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  return open === -1 || close === -1 ? undefined : body.slice(0, close);
};

// An iteration's own **Goal:** bullet, folded from its continuation lines into one sentence —
// undefined when the plan declares no such iteration or the bullet is absent.
export const goalOf = (source: string, iteration: string): string | undefined => {
  const lines = source.split('\n');
  const bounds = iterationBounds(lines, iteration);

  if (bounds === undefined) {
    return undefined;
  }

  const section = lines.slice(bounds[0], bounds[1]);
  const goalStart = section.findIndex((line) => /^- \*\*Goal:\*\*/.test(line));

  if (goalStart === -1) {
    return undefined;
  }

  // Continuation lines fold into the same sentence: a `**Goal:**` bullet reads as one paragraph
  // up to the next `- **` bullet or blank line, never as a truncated first line.
  const goalRest = section.slice(goalStart + 1).findIndex((line) => /^- \*\*/.test(line) || line.trim() === '');
  const goalEnd = goalRest === -1 ? section.length : goalStart + 1 + goalRest;

  return section
    .slice(goalStart, goalEnd)
    .map((line) => line.trim())
    .join(' ')
    .replace(/^- \*\*Goal:\*\* */, '');
};
