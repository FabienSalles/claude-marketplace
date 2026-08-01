// The ten refusals a run judges before writing a byte, worded exactly as goal-run.sh words
// them: policy, remote, branch, clean tree, ignored plan directory, cleanup iteration inside a
// feature plan, existing lock, base sweep (with the Bootstrap carve-out), branch behind its
// base, and the deny rule. Every one is a refusal, never a warning, and every one runs before
// the lock is taken: a run that starts wrong is worse than one that never starts.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import { header, iterationNumbers } from '../gate/plan.ts';
import type { Reporter } from './report.ts';

export const REFUSED = 2;

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

const sweepCommands = (source: string): string[] => {
  const commands: string[] = [];
  let inFence = false;

  for (const line of source.split('\n')) {
    if (line.trim() === '```gate') {
      inFence = true;
      continue;
    }

    if (line.trim() === '```') {
      inFence = false;
      continue;
    }

    if (!inFence) {
      continue;
    }

    const dod = /^dod[0-9]+=(.*)$/.exec(line);

    if (dod) {
      commands.push(dod[1]!);
      continue;
    }

    const gate = /^gate([0-9]+)=(.*)$/.exec(line);

    if (gate && Number(gate[1]) >= 2) {
      commands.push(gate[2]!);
    }
  }

  return commands;
};

export type PreflightResult = {
  policy: string;
  remote: string;
  workId: string;
  cleanup: boolean;
};

export const preflight = (plan: string, source: string, reporter: Reporter, gate: string): PreflightResult => {
  const planBase = basename(plan);
  let workId: string;
  let cleanup: boolean;

  if (planBase.endsWith('-cleanup-spec.md')) {
    workId = planBase.slice(0, -'-cleanup-spec.md'.length);
    cleanup = true;
  } else if (planBase.endsWith('-spec.md')) {
    workId = planBase.slice(0, -'-spec.md'.length);
    cleanup = false;
  } else {
    workId = planBase.replace(/\.md$/, '');
    cleanup = false;
  }

  // 1. Policy — unattended execution needs somewhere to put the work; manual means nothing may
  // be committed, so there is nothing here to chain.
  const policy = header(source, 'Policy:');

  if (policy === undefined) {
    reporter.stop('the plan declares no Policy line', REFUSED);
  }

  if (policy === 'manual') {
    reporter.stop(
      'Policy is manual, so nothing may be committed and there is nothing to run unattended. Change the Policy line in the spec, or run the manual loop with /goal and /goal:next.',
      REFUSED,
    );
  }

  // 2. Remote — never defaulted to origin. A bare push on a fork lands on the fork; guessing
  // here means a run pushes and opens its pull request on somebody else's repository, unattended.
  const remote = header(source, 'Remote:');

  if (!remote) {
    reporter.stop('the plan declares no Remote line', REFUSED);
  }

  // 3. Branch — the checkout must stand on the branch this run is meant to advance, or it
  // publishes the wrong one.
  const branchOut = git('rev-parse', '--abbrev-ref', 'HEAD');

  if (branchOut.status !== 0) {
    reporter.stop('not a git repository', REFUSED);
  }

  const branch = branchOut.stdout.trim();

  if (branch !== `feature/${workId}` && !branch.startsWith(`feature/${workId}-`)) {
    reporter.stop(`the checkout stands on ${branch}, not feature/${workId} (or feature/${workId}-...)`, REFUSED);
  }

  // 4. Clean tree — uncommitted work would end up in the first iteration's commit, unreviewed.
  const dirty = git('status', '--short').stdout.replace(/\n$/, '');

  if (dirty !== '') {
    reporter.stop(`the tree is not clean:\n${dirty}`, REFUSED);
  }

  // 5. What the run writes must be out of git's sight, or the spec, the ticked box and this
  // run's own log become an undeclared modification the gate reads as a scope leak.
  const planDir = dirname(plan);

  if (git('check-ignore', '-q', planDir).status !== 0) {
    reporter.stop(
      `the plan's directory is visible to git: ${planDir}. Ignore it, untracking any spec already committed.`,
      REFUSED,
    );
  }

  // 6. No cleanup iteration hiding inside a feature plan: its Trigger asserts something about
  // production this run cannot observe, and running it here deletes the fallback in the same PR
  // that introduces what falls back to it.
  if (!cleanup && source.includes('**Trigger:**')) {
    reporter.stop(
      'the plan carries a cleanup iteration (a Trigger: line) inside a feature plan. Move it out with /goal:run-issue, or run the *-cleanup-spec.md plan directly.',
      REFUSED,
    );
  }

  // 7. No run already holds the plan.
  if (existsSync(`${plan}.run.lock`)) {
    reporter.stop(
      `another run holds this plan: ${plan}.run.lock. Wait for it, or free it with: ${gate} unlock ${plan}`,
      REFUSED,
    );
  }

  // 8. The base is already green — the highest-return check in the whole preflight. Every
  // command the plan will hold every iteration to, run once now, against the untouched tree.
  // gate1 is excluded: it is the bitten criterion, supposed to fail without the implementation.
  const bootstrap = header(source, 'Bootstrap:');
  const skipSweep = bootstrap !== undefined && bootstrap !== '' && !iterationNumbers(source, true).includes(bootstrap);

  if (skipSweep) {
    reporter.say(`RUN base sweep skipped: Bootstrap iteration ${bootstrap} is not built yet`);
  } else {
    for (const cmd of sweepCommands(source)) {
      const result = spawnSync(cmd, { shell: true, encoding: 'utf8' });

      if (result.status !== 0) {
        reporter.stop(
          `the base is not green: \`${cmd}\` exited ${result.status} before this run wrote a line:\n${result.stdout}${result.stderr}`,
          REFUSED,
        );
      }
    }
  }

  // 9. The branch must be caught up with what it forked from — implementing against a base the
  // branch has since moved past ships a diff that conflicts, and certifies check 8 green against
  // a base nobody will merge into.
  git('fetch', '--prune', '--quiet');
  const originBaseOut = git('rev-parse', '--abbrev-ref', 'origin/HEAD');
  const originBase = originBaseOut.status === 0 ? originBaseOut.stdout.trim() : branch;

  if (git('merge-base', '--is-ancestor', originBase, 'HEAD').status !== 0) {
    const missing = git('log', '--oneline', `HEAD..${originBase}`).stdout.replace(/\n$/, '');
    reporter.stop(`the branch is behind ${originBase}:\n${missing}\n\nFetch and rebase before relaunching.`, REFUSED);
  }

  // 10. Deny — the implementer runs as an ordinary Claude Code session; without a settings rule
  // denying it `git commit`, `git push` and `git add`, "only the gate commits" is a sentence in
  // the plan and not a fact this run can stand behind. goal-deny-setup.sh installs the rule once;
  // this only reads for it.
  const denyFile = resolve(process.cwd(), '.claude', 'settings.local.json');
  const denyContent = existsSync(denyFile) ? readFileSync(denyFile, 'utf8') : '';
  const denyMissing = ['commit', 'push', 'add'].filter((verb) => !denyContent.includes(`git ${verb}`));

  if (denyMissing.length > 0) {
    const here = resolve(import.meta.dirname, '..');
    reporter.stop(
      `the implementer is not denied git ${denyMissing.join(' ')}. Run: ${here}/goal-deny-setup.sh`,
      REFUSED,
    );
  }

  return { policy, remote, workId, cleanup };
};
