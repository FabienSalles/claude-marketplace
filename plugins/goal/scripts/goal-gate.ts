#!/usr/bin/env node
// The single authority of an autonomous run. TypeScript, run natively by node:
// no build step, no dependency. Types are stripped at run time, never checked —
// `tsc --noEmit` is a CI concern.
//
// Usage: node goal-gate.ts check <plan> <iteration> [plan_hash]
//
// Exit codes: 0 the iteration is runnable · 1 HALT, with a reason · 2 misuse.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const USAGE = 'usage: goal-gate.ts check <plan> <iteration> [plan_hash]';

const ALLOWED_KEY = /^(test_files|impl_files|max_diff|commit_msg|gate[1-9][0-9]*)$/;
const REQUIRED_KEYS = ['gate1', 'impl_files', 'commit_msg'] as const;

const halt: (reason: string, detail: string) => never = (reason, detail) => {
  process.stdout.write(`HALT\n\nREASON: ${reason}\n\nDETAIL:\n${detail}\n`);
  process.exit(1);
};

const misuse: (message: string) => never = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

const readPlan = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return misuse(`plan not readable: ${path}`);
  }
};

// A tick is the one edit an iteration is allowed to make to its own contract, so the
// hash is taken over the plan with every box unticked.
const planHash = (source: string): string =>
  createHash('sha256').update(source.replace(/^- \[x\]/gm, '- [ ]')).digest('hex');

const iterationSection = (source: string, iteration: string): string[] => {
  const lines = source.split('\n');
  const heading = new RegExp(`^### Iteration ${iteration}\\b`);
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) {
    halt(
      `The plan declares no iteration ${iteration}.`,
      `No "### Iteration ${iteration}" heading found.\n\nThe loop asked for an iteration the plan does not contain: either the plan was rewritten or the caller counted wrong. Nothing was run.`,
    );
  }

  const body = lines.slice(start + 1);
  const end = body.findIndex((line) => /^#{2,3} /.test(line));

  return end === -1 ? body : body.slice(0, end);
};

const gateBlock = (section: string[], iteration: string): string[] => {
  const open = section.findIndex((line) => line.trim() === '```gate');
  const body = section.slice(open + 1);
  const close = body.findIndex((line) => line.trim() === '```');

  if (open === -1 || close === -1) {
    halt(
      `Iteration ${iteration} declares no gate block.`,
      'The iteration section holds no closed ```gate fence.\n\nAn iteration with no gate block has no acceptance criterion, no declared scope and no commit message, so nothing can be verified about it. The global Definition of Done block is not a substitute: it belongs to the plan, not to this slice.',
    );
  }

  return body.slice(0, close);
};

const declaredKeys = (block: string[]): Map<string, string> => {
  const declared = new Map<string, string>();

  for (const line of block) {
    if (line.trim() === '') {
      continue;
    }

    const split = line.indexOf('=');
    const key = split === -1 ? line.trim() : line.slice(0, split).trim();
    declared.set(key, split === -1 ? '' : line.slice(split + 1).trim());
  }

  return declared;
};

const main = (): void => {
  const [subcommand, plan, iteration, locked] = process.argv.slice(2);

  if (subcommand !== 'check' || plan === undefined || iteration === undefined) {
    misuse(USAGE);
  }

  if (!/^[0-9]+$/.test(iteration)) {
    misuse(`${USAGE}\niteration must be a number, got: ${iteration}`);
  }

  const source = readPlan(plan);
  const hash = planHash(source);

  if (locked !== undefined && locked !== hash) {
    halt(
      `The plan was modified during iteration ${iteration}, beyond ticking a box.`,
      `Locked normalized hash ${locked}\nFound            ${hash}\n\nThe executor rewrote its own contract. Review ${plan} and the last diff before resuming.`,
    );
  }

  const declared = declaredKeys(gateBlock(iterationSection(source, iteration), iteration));

  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_KEY.test(key));

  if (forbidden.length > 0) {
    halt(
      `Iteration ${iteration} declares a key it may not set.`,
      `Refused: ${forbidden.join(' ')}\n\nAn iteration gate block sets only test_files, impl_files, max_diff, commit_msg and gate1..N. Any other key either belongs to the run rather than the slice — the plan hash, the global DoD, whether anything ships — or is not a key at all. A slice that could set them would be rewriting the terms it is judged by.`,
    );
  }

  const missing = REQUIRED_KEYS.filter((key) => (declared.get(key) ?? '') === '');

  if (missing.length > 0) {
    halt(
      `Iteration ${iteration} is not runnable unattended.`,
      `Missing or empty: ${missing.join(' ')}\n\ngate1 is the acceptance criterion — without it the iteration exits 0 having proved nothing, which is exactly what the loop must never advance on. impl_files is the reference the scope check is made against. commit_msg is the message the slice is committed under. Write them into the gate block, or halt and report that this slice cannot be verified unattended.`,
    );
  }

  const commands = [...declared.keys()].filter((key) => key.startsWith('gate')).length;

  process.stdout.write(
    `OK: iteration ${iteration} is runnable (${commands} acceptance command(s)).\nplan_hash=${hash}\n`,
  );
};

main();
