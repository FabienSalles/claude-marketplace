// The ten refusals a run judges before writing a byte: policy, remote, branch, ignored goal-runs
// directory, clean tree, ignored plan directory, cleanup iteration inside a feature plan,
// existing lock, base sweep (with the Bootstrap carve-out), and branch behind its base. Every one
// is a refusal, never a warning, and every one runs before the lock is taken: a run that starts
// wrong is worse than one that never starts.
//
// A `.claude/settings.local.json` deny rule is not among them: an earlier check reading it was a
// substring match over raw JSON, so a file whose permissions.allow granted `Bash(git commit:*)`
// satisfied it while granting the opposite; it was installed project-wide, so it also restrained
// the interactive session where the developer reads every diff; and permissions are read at
// session start, so it described a future session and never the running one. What replaces it is
// detection in run/iteration.ts, which is executed.

import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { git } from '../adapters/git.ts';
import {
  caughtUpWithBase,
  cleanTree,
  featureBranch,
  freeLock,
  goalRunsIgnored,
  metadataDeclared,
  noCleanupIteration,
  planDirIgnored,
  remoteDeclared,
  runnablePolicy,
} from '../core/preflight.ts';
import { workIdOf } from '../core/plan.ts';
import { REFUSED } from '../core/verdict.ts';
import { frontmatter, header, iterationNumbers, topRegion } from '../gate/plan.ts';
import { autoUpdaterWarning } from './advisory.ts';
import type { Reporter } from './report.ts';
import { quote } from './shell.ts';
import { sweep } from './sweep.ts';

export { REFUSED } from '../core/verdict.ts';

// Re-exported for anything that needs a plan's work-id ahead of a full preflight() call — a
// test fixture asserting on the run directory it names, chief among them.
export { workIdOf };

export type PreflightResult = {
  policy: string;
  remote: string;
  workId: string;
  cleanup: boolean;
};

export const preflight = (plan: string, source: string, reporter: Reporter, gate: string): PreflightResult => {
  const planBase = basename(plan);
  const workId = workIdOf(plan);
  const cleanup = planBase.endsWith('-cleanup-spec.md');

  // 0. Metadata block — every Key: line the plan declares belongs in one `---`-delimited block
  // at the top of the file, or the checks below silently read nothing. Refused before any of
  // them runs, with the plan's own header lines already wrapped so the fix is a straight paste.
  const legacy = topRegion(source)
    .split('\n')
    .filter((line) => /^[A-Z][\w -]*: .*$/.test(line));
  const metadata = metadataDeclared(frontmatter(source) !== undefined, legacy);

  if (!metadata.ok) {
    reporter.stop(metadata.error, REFUSED);
  }

  reporter.say('RUN preflight: the plan carries a --- metadata block');

  // 1. Policy — unattended execution needs somewhere to put the work; manual means nothing may
  // be committed, so there is nothing here to chain.
  const policyResult = runnablePolicy(header(source, 'Policy:'));

  if (!policyResult.ok) {
    reporter.stop(policyResult.error, REFUSED);
  }

  const policy = policyResult.value;

  // 2. Remote — never defaulted to origin. A bare push on a fork lands on the fork; guessing
  // here means a run pushes and opens its pull request on somebody else's repository, unattended.
  const remoteResult = remoteDeclared(header(source, 'Remote:'));

  if (!remoteResult.ok) {
    reporter.stop(remoteResult.error, REFUSED);
  }

  const remote = remoteResult.value;

  // 3. Branch — the checkout must stand on the branch this run is meant to advance, or it
  // publishes the wrong one.
  const branchOut = git('rev-parse', '--abbrev-ref', 'HEAD');
  const branchResult = featureBranch(branchOut.status === 0, branchOut.stdout.trim(), workId);

  if (!branchResult.ok) {
    reporter.stop(branchResult.error, REFUSED);
  }

  const branch = branchResult.value;

  // 4. The run's own log directory must be out of git's sight before the tree is judged clean,
  // or that check fires on this run's fresh records with "the tree is not clean" — the symptom,
  // not the cause. Held before check 5, since the run's log directory is created before preflight
  // runs. The check holds before the directory exists: check-ignore evaluates patterns, not files.
  const goalRunsDir = '.claude/goal-runs';
  const goalRunsResult = goalRunsIgnored(git('check-ignore', '-q', goalRunsDir).status === 0, goalRunsDir);

  if (!goalRunsResult.ok) {
    reporter.stop(goalRunsResult.error, REFUSED);
  }

  // 5. Clean tree — uncommitted work would end up in the first iteration's commit, unreviewed.
  const dirty = git('status', '--short').stdout.replace(/\n$/, '');
  const cleanTreeResult = cleanTree(dirty);

  if (!cleanTreeResult.ok) {
    reporter.stop(cleanTreeResult.error, REFUSED);
  }

  // 6. What the run writes must be out of git's sight, or the spec, the ticked box and this
  // run's own log become an undeclared modification the gate reads as a scope leak. Nothing
  // narrates before this point: a line written ahead of this check would itself dirty the
  // tree check 5 just ran, on the very tree this check exists to catch as untracked.
  const planDir = dirname(plan);
  const planDirResult = planDirIgnored(git('check-ignore', '-q', planDir).status === 0, planDir);

  if (!planDirResult.ok) {
    reporter.stop(planDirResult.error, REFUSED);
  }

  reporter.say(`RUN preflight: Policy is ${policy}`);
  reporter.say(`RUN preflight: Remote is ${remote}`);
  reporter.say(`RUN preflight: branch is ${branch}`);
  reporter.say('RUN preflight: the tree is clean');
  reporter.say(`RUN preflight: plan directory ${planDir} is git-ignored`);

  // 7. No cleanup iteration hiding inside a feature plan: its Trigger asserts something about
  // production this run cannot observe, and running it here deletes the fallback in the same PR
  // that introduces what falls back to it.
  const cleanupResult = noCleanupIteration(cleanup, source.includes('**Trigger:**'));

  if (!cleanupResult.ok) {
    reporter.stop(cleanupResult.error, REFUSED);
  }

  reporter.say(
    cleanup ? 'RUN preflight: cleanup plan, its Trigger line is left alone' : 'RUN preflight: no cleanup iteration inside this feature plan',
  );

  // 8. No run already holds the plan.
  const lockPath = `${plan}.run.lock`;
  const lockResult = freeLock(existsSync(lockPath), lockPath, `${gate} unlock ${quote(plan)}`);

  if (!lockResult.ok) {
    reporter.stop(lockResult.error, REFUSED);
  }

  reporter.say('RUN preflight: no other run holds the lock');

  // 9. The base is already green — the highest-return check in the whole preflight. Every
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

  // 10. The branch must be caught up with what it forked from — implementing against a base the
  // branch has since moved past ships a diff that conflicts, and certifies check 9 green against
  // a base nobody will merge into. The base to compare against: the plan's own `PR base:`
  // header — a bare branch name on the declared remote, the same one publish.ts passes to
  // `gh pr create --base` — when it resolves there, else `<remote>/HEAD` (the fork this run
  // pushes to, when it is not origin), else `origin/HEAD` — today's behaviour, unaffected when
  // the plan declares neither, or declares a base this checkout has not fetched.
  git('fetch', '--prune', '--quiet');
  const prBase = header(source, 'PR base:');
  const candidates = [...(prBase ? [`${remote}/${prBase}`] : []), `${remote}/HEAD`, 'origin/HEAD'];

  // Tried batched first: one process for every candidate, in priority order, is enough whenever
  // they all resolve — the common case. A single one of them failing makes git abort the whole
  // batch without finishing the others, so that failure alone is not proof they all did; only
  // the sequential fallback below, one candidate at a time, still tells which one first resolves.
  const batched = git('rev-parse', '--abbrev-ref', ...candidates);
  let base: string | undefined = batched.status === 0 ? batched.stdout.split('\n')[0]?.trim() : undefined;

  if (base === undefined) {
    for (const candidate of candidates) {
      const out = git('rev-parse', '--abbrev-ref', candidate);

      if (out.status === 0) {
        base = out.stdout.trim();
        break;
      }
    }
  }

  base ??= branch;

  const isAncestor = git('merge-base', '--is-ancestor', base, 'HEAD').status === 0;
  const missing = git('log', '--oneline', `HEAD..${base}`).stdout.replace(/\n$/, '');
  const behindResult = caughtUpWithBase(isAncestor, base, missing);

  if (!behindResult.ok) {
    reporter.stop(behindResult.error, REFUSED);
  }

  reporter.say(`RUN preflight: branch is caught up with ${base}`);

  const warning = autoUpdaterWarning();

  if (warning) {
    reporter.say(`RUN preflight: warning — ${warning}`);
  }

  return { policy, remote, workId, cleanup };
};
