// The nine refusals a run judges before writing a byte: policy, remote, branch, clean tree,
// ignored plan directory, cleanup iteration inside a feature plan, existing lock, base sweep
// (with the Bootstrap carve-out), and branch behind its base. Every one is a refusal, never a
// warning, and every one runs before the lock is taken: a run that starts wrong is worse than
// one that never starts.
//
// A `.claude/settings.local.json` deny rule is not among them: an earlier check reading it was a
// substring match over raw JSON, so a file whose permissions.allow granted `Bash(git commit:*)`
// satisfied it while granting the opposite; it was installed project-wide, so it also restrained
// the interactive session where the developer reads every diff; and permissions are read at
// session start, so it described a future session and never the running one. What replaces it is
// detection in run/iteration.ts, which is executed.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import { header, iterationNumbers } from '../gate/plan.ts';
import type { Reporter } from './report.ts';
import { REFUSED, sweep } from './sweep.ts';

export { REFUSED } from './sweep.ts';

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

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
  // run's own log become an undeclared modification the gate reads as a scope leak. Nothing
  // narrates before this point: the log this reporter writes to lives inside the plan's
  // directory, and a line written to it ahead of this check would itself dirty the tree check 4
  // just ran, on the very tree this check exists to catch as untracked.
  const planDir = dirname(plan);

  if (git('check-ignore', '-q', planDir).status !== 0) {
    reporter.stop(
      `the plan's directory is visible to git: ${planDir}. Ignore it, untracking any spec already committed.`,
      REFUSED,
    );
  }

  reporter.say(`RUN preflight: Policy is ${policy}`);
  reporter.say(`RUN preflight: Remote is ${remote}`);
  reporter.say(`RUN preflight: branch is ${branch}`);
  reporter.say('RUN preflight: the tree is clean');
  reporter.say(`RUN preflight: plan directory ${planDir} is git-ignored`);

  // 6. No cleanup iteration hiding inside a feature plan: its Trigger asserts something about
  // production this run cannot observe, and running it here deletes the fallback in the same PR
  // that introduces what falls back to it.
  if (!cleanup && source.includes('**Trigger:**')) {
    reporter.stop(
      'the plan carries a cleanup iteration (a Trigger: line) inside a feature plan. Move it out with /goal:run-issue, or run the *-cleanup-spec.md plan directly.',
      REFUSED,
    );
  }

  reporter.say(
    cleanup ? 'RUN preflight: cleanup plan, its Trigger line is left alone' : 'RUN preflight: no cleanup iteration inside this feature plan',
  );

  // 7. No run already holds the plan.
  if (existsSync(`${plan}.run.lock`)) {
    reporter.stop(
      `another run holds this plan: ${plan}.run.lock. Wait for it, or free it with: ${gate} unlock ${plan}`,
      REFUSED,
    );
  }

  reporter.say('RUN preflight: no other run holds the lock');

  // 8. The base is already green — the highest-return check in the whole preflight. Every
  // distinct command the plan will hold every iteration to, run once now, against the untouched
  // tree. gate1 is excluded: it is the bitten criterion, supposed to fail without the
  // implementation.
  const bootstrap = header(source, 'Bootstrap:');
  const skipSweep = bootstrap !== undefined && bootstrap !== '' && !iterationNumbers(source, true).includes(bootstrap);

  if (skipSweep) {
    reporter.say(`RUN base sweep skipped: Bootstrap iteration ${bootstrap} is not built yet`);
  } else {
    sweep(source, reporter);
  }

  // 9. The branch must be caught up with what it forked from — implementing against a base the
  // branch has since moved past ships a diff that conflicts, and certifies check 8 green against
  // a base nobody will merge into. The base to compare against: the plan's own `PR base:`
  // header — a bare branch name on the declared remote, the same one publish.ts passes to
  // `gh pr create --base` — when it resolves there, else `<remote>/HEAD` (the fork this run
  // pushes to, when it is not origin), else `origin/HEAD` — today's behaviour, unaffected when
  // the plan declares neither, or declares a base this checkout has not fetched.
  git('fetch', '--prune', '--quiet');
  const prBase = header(source, 'PR base:');
  let base: string | undefined;

  if (prBase) {
    const prBaseOut = git('rev-parse', '--abbrev-ref', `${remote}/${prBase}`);
    base = prBaseOut.status === 0 ? prBaseOut.stdout.trim() : undefined;
  }

  if (!base) {
    const remoteHeadOut = git('rev-parse', '--abbrev-ref', `${remote}/HEAD`);
    base = remoteHeadOut.status === 0 ? remoteHeadOut.stdout.trim() : undefined;
  }

  if (!base) {
    const originHeadOut = git('rev-parse', '--abbrev-ref', 'origin/HEAD');
    base = originHeadOut.status === 0 ? originHeadOut.stdout.trim() : branch;
  }

  if (git('merge-base', '--is-ancestor', base, 'HEAD').status !== 0) {
    const missing = git('log', '--oneline', `HEAD..${base}`).stdout.replace(/\n$/, '');
    reporter.stop(`the branch is behind ${base}:\n${missing}\n\nFetch and rebase before relaunching.`, REFUSED);
  }

  reporter.say(`RUN preflight: branch is caught up with ${base}`);

  return { policy, remote, workId, cleanup };
};
