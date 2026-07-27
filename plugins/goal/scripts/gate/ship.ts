// The last barrier before anything is published, and the guard on the push itself.

import { spawnSync } from 'node:child_process';

import { halt } from './halt.ts';
import { declaredKeys, gateBlock } from './plan.ts';

export const ALLOWED_DOD_KEY = /^dod[1-9][0-9]*$/;
export const SCANNERS = ['betterleaks', 'gitleaks'];

// The barrier replayed once before anything ships. Every slice gate only ever saw its own slice,
// so a run that pushed on the strength of those alone would never have run the whole suite
// against the whole branch.
export const dodCheck = (source: string): void => {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^## Definition of Done\b/.test(line));

  if (start === -1) {
    halt(
      'The plan declares no global Definition of Done.',
      'No "## Definition of Done" heading found.\n\nThe DoD is the last barrier before anything is pushed: without it a run would ship on the strength of its per-slice gates alone, each of which only ever judged its own slice against its own commands.',
    );
  }

  const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));
  const section = lines.slice(start + 1, next === -1 ? lines.length : start + 1 + next);
  const declared = declaredKeys(
    gateBlock(section, "The plan's Definition of Done"),
    "The plan's Definition of Done",
  );

  const forbidden = [...declared.keys()].filter((key) => !ALLOWED_DOD_KEY.test(key));

  if (forbidden.length > 0) {
    halt(
      "The plan's Definition of Done declares a key it may not set.",
      `Refused: ${forbidden.join(' ')}\n\nThe global block sets dod1..N and nothing else. A gate1 written here would be read by no verb at all, so the command it names would never run while the plan claimed it as a barrier.`,
    );
  }

  if ((declared.get('dod1') ?? '') === '') {
    halt(
      "The plan's Definition of Done names no command.",
      'Missing or empty: dod1\n\nA barrier that runs nothing exits 0 on anything, which is the failure this harness exists to remove. Write the commands that prove the whole plan is done, or say that the plan cannot be verified.',
    );
  }

  for (const [key, command] of [...declared.entries()].sort(([a], [b]) => Number(a.slice(3)) - Number(b.slice(3)))) {
    const run = spawnSync(command, { shell: true, encoding: 'utf8' });

    if (run.status !== 0) {
      halt(
        `The global Definition of Done fails at ${key}.`,
        `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nEvery slice was gated green and the plan as a whole is not. Nothing has been pushed.`,
      );
    }
  }

  process.stdout.write(`OK: the global Definition of Done passed ${declared.size} command(s).\n`);
};

// betterleaks first, gitleaks second, and a refusal if neither is installed: a push nobody
// scanned is exactly how a halted branch publishes a .env. Both take `dir`, betterleaks being a
// drop-in replacement for the gitleaks CLI.
export const secretScan = (): void => {
  const scanner = SCANNERS.find(
    (name) => spawnSync(`command -v ${name}`, { shell: true }).status === 0,
  );

  if (scanner === undefined) {
    halt(
      'No secret scanner is installed, so nothing may be pushed.',
      `Looked for: ${SCANNERS.join(' ')}\n\nThe guard refuses rather than degrades: a run that pushed unscanned would publish whatever the tree holds, and a halted branch is pushed too. Install one of the above, or push by hand having read the diff.`,
    );
  }

  const command = `${scanner} dir . --redact`;
  const run = spawnSync(command, { shell: true, encoding: 'utf8' });

  if (run.status !== 0) {
    halt(
      `${scanner} refuses this tree, so nothing was pushed.`,
      `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nEither the tree holds a secret — rotate it, it is already in the local history — or the scanner does not support this invocation, which the command above tells you.`,
    );
  }

  process.stdout.write(`OK: ${scanner} found no secret.\n`);
};
