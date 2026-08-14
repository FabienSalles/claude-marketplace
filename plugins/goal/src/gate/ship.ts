import { command as runner } from '../adapters/command.ts';
import { doneSection } from '../core/plan.ts';
import { bounded, spawnOptions } from './bounded.ts';
import { halt } from './halt.ts';
import { declaredKeys, gateBlock } from './plan.ts';

export const ALLOWED_DOD_KEY = /^dod[1-9][0-9]*$/;
export const SCANNERS = ['betterleaks', 'gitleaks'];

export const dodCheck = (source: string): string => {
  const section = doneSection(source);

  if (section === undefined) {
    halt(
      'The plan declares no global Definition of Done.',
      'No "## Definition of Done" heading found.\n\nThe DoD is the last barrier before anything is pushed: without it a run would ship on the strength of its per-slice gates alone, each of which only ever judged its own slice against its own commands.',
    );
  }

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
    const run = runner.run(bounded(command), [], spawnOptions());

    if (run.status !== 0) {
      halt(
        `The global Definition of Done fails at ${key}.`,
        `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nEvery slice was gated green and the plan as a whole is not. The last iteration's push is held behind this barrier, so its commit stays local; every iteration before it already published as it landed and is on the remote.`,
      );
    }
  }

  return `OK: the global Definition of Done passed ${declared.size} command(s).\n`;
};

// betterleaks first, gitleaks second, and a refusal if neither is installed: a push nobody
// scanned is exactly how a halted branch publishes a .env. betterleaks is a drop-in replacement
// for the gitleaks CLI, so both take the same verbs.
//
// `git`, not `dir`: the scan exists to judge what a push publishes, and a push carries commits,
// not the working directory. `dir` reads everything on disk including gitignored files, so a
// finding there refuses a push over something the push could never have carried. That is not
// hypothetical — a run's own execution log, gitignored and rewritten on every iteration, held
// the Supabase local demo anon key and blocked every push permanently, over a credential that is
// a published default identical on every machine.
//
// The trade-off is deliberate: `git` reads the branch's history, so a secret committed three
// slices ago still refuses. That is the correct answer, because pushing the branch publishes
// that commit too, and a scan of the current tree alone would wave it through.
export const secretScan = (): string => {
  const scanner = SCANNERS.find(
    (name) => runner.run(`command -v ${name}`, [], { shell: true }).status === 0,
  );

  if (scanner === undefined) {
    halt(
      'No secret scanner is installed, so nothing may be pushed.',
      `Looked for: ${SCANNERS.join(' ')}\n\nThe guard refuses rather than degrades: a run that pushed unscanned would publish whatever the tree holds, and a halted branch is pushed too. Install one of the above, or push by hand having read the diff.`,
    );
  }

  const command = `${scanner} git . --redact`;
  const run = runner.run(bounded(command), [], spawnOptions());

  if (run.status !== 0) {
    halt(
      `${scanner} refuses this branch's commits, so nothing was pushed.`,
      `Command: ${command}\nExit code: ${run.status}\n\nOutput:\n${`${run.stdout}${run.stderr}`.slice(-4000)}\n\nThe finding is in committed content, so pushing would publish it: rotate whatever it holds, it is already in the local history, and a later deletion does not remove it. An untracked or gitignored file cannot produce this — the scan reads commits, not the working directory.`,
    );
  }

  return `OK: ${scanner} found no secret.\n`;
};
