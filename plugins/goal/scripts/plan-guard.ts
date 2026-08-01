#!/usr/bin/env node
// Hashes every `gateN=` and `dodN=` line a plan declares, and refuses when that hash moved.
//
// A prompt told never to weaken a gate is a sentence. This is the mechanism: the acceptance
// commands of every iteration and of the global Definition of Done, hashed together, so a run
// can prove none of them was rewritten between the moment it was locked and the moment it ships.
//
// Usage: node plan-guard.ts <plan>              print the current hash
//        node plan-guard.ts <plan> <locked_hash> compare, exit non-zero if it moved
//
// Exit codes: 0 unchanged (or nothing to compare against) · 1 a gate or dod line moved · 2 misuse.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { halt, misuse } from './gate/halt.ts';

const GUARDED_LINE = /^(gate[1-9][0-9]*|dod[1-9][0-9]*)=.*$/;

export const guardedLines = (source: string): string[] =>
  source.split('\n').filter((line) => GUARDED_LINE.test(line.trim()));

export const guardHash = (source: string): string =>
  createHash('sha256').update(guardedLines(source).join('\n')).digest('hex');

const main = (): void => {
  const [plan, locked] = process.argv.slice(2);

  if (plan === undefined) {
    misuse('usage: plan-guard.ts <plan> [locked_hash]');
  }

  let source: string;

  try {
    source = readFileSync(plan, 'utf8');
  } catch {
    misuse(`plan not readable: ${plan}`);
    return;
  }

  const hash = guardHash(source);

  if (locked === undefined) {
    process.stdout.write(`guard_hash=${hash}\n`);

    return;
  }

  if (locked !== hash) {
    halt(
      'A gate or dod line moved since it was locked.',
      `Locked ${locked}\nFound  ${hash}\n\nEvery gate1..N and dod1..N line in ${plan} is hashed together. A rewritten acceptance command is not a smaller iteration, it is a different one, and a run judged against it would have moved the bar it was supposed to clear.`,
    );

    return;
  }

  process.stdout.write('OK: no gate or dod line moved.\n');
};

main();
