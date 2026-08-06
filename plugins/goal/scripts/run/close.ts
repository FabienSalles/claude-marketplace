// The closing stage: replayed once every requested iteration has landed, gate-verified. A pass
// marks the run's own open pull request ready — never one `gh` merely reports, since that could
// belong to an earlier run — and the advisory lens and the auditor are invoked either way,
// neither able to undo work the gate already verified and shipped.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { header, iterationNumbers, readPlan } from '../gate/plan.ts';
import type { Publisher } from './publish.ts';
import type { Reporter } from './report.ts';
import { git, quote } from './shell.ts';

export const LANDED = 0;
export const HALTED = 1;

// `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
const repoOf = (remote: string): string =>
  git('remote', 'get-url', remote)
    .stdout.trim()
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');

// What close() reads instead of asking `gh` for the pull request's own state: whether this run's
// policy publishes at all, whether this run opened or found one, and whether publication ever
// blocked — threaded from run/publish.ts's own bookkeeping.
export type PublishState = {
  publishes: boolean;
  prOpen: boolean;
  blocked: boolean;
};

export const close = (
  plan: string,
  gate: string,
  hash: string,
  remote: string,
  publisher: Publisher,
  landed: string[],
  dir: string,
  reporter: Reporter,
): number => {
  const jsonl = join(dir, '.run.jsonl');
  const dodStart = Date.now();
  const dod = spawnSync(`${gate} dod ${quote(plan)} ${quote(hash)}`, { shell: true, encoding: 'utf8' });
  const dodOut = `${dod.stdout}${dod.stderr}`;
  const dodExit = dod.status ?? 1;
  reporter.say(`RUN stage=dod duration_ms=${Date.now() - dodStart} exit=${dodExit}`);

  // The plan on disk, re-read here rather than trusted from before this run started: every box
  // the gate ticked, this run's own or an earlier run's, is on it now.
  const source = readPlan(plan);
  const ticked = iterationNumbers(source, true);
  const postsReview = header(source, 'Review:') === 'comment';

  if (dodExit === 0) {
    // The last iteration's own push, held back until now: nothing this run committed reaches the
    // remote until the whole-branch Definition of Done says so.
    const last = landed[landed.length - 1];

    if (last !== undefined) {
      const pushStart = Date.now();
      publisher.publish(last);
      reporter.say(`RUN stage=push duration_ms=${Date.now() - pushStart} exit=${publisher.state.blocked ? 1 : 0}`);
    }

    reporter.say('RUN the global Definition of Done passed');
    const repo = repoOf(remote);
    const publish = publisher.state;

    if (publish.publishes && publish.prOpen && !publish.blocked) {
      const branch = git('branch', '--show-current').stdout.trim();
      const readyStart = Date.now();
      const ready = spawnSync('gh', ['pr', 'ready', '--repo', repo, branch], { encoding: 'utf8' });
      const readyOut = `${ready.stdout}${ready.stderr}`;
      reporter.say(`RUN stage=pull-request-update duration_ms=${Date.now() - readyStart} exit=${ready.status ?? 1}`);

      if ((ready.status ?? 1) === 0) {
        reporter.say('RUN the pull request was marked ready');

        // The reviewer runs at the one moment publication cannot still be blocked behind it: the
        // pull request just went ready. It comments, never `REQUEST_CHANGES` — pushed work is
        // already shipped, and a review that cannot block would only add friction to clear by
        // hand.
        const reviewBrief = `Review the pull request for ${branch} on ${repo}, carrying iteration(s) ${ticked.join(' ')} of ${basename(plan)}, which was just marked ready for review.

Read the plan's own declarations for each landed iteration and the commits on this branch, then
write one review with inline comments: design, error handling, security posture, and this
project's own conventions — the reading a gate is not built to give.

${postsReview
  ? 'This plan carries a `Review: comment` header, opting into posting. Post it with `gh` as a comment review, never `REQUEST_CHANGES`: nothing you post can block a pull request that already shipped. Open the review with a banner stating plainly that it is the output of the goal-run-reviewer AI agent, never written as if the developer authored it.'
  : 'This plan carries no `Review: comment` header. Do not post it to GitHub: return your review as text, so it reaches the developer through the run log only.'}`;

        const reviewStart = Date.now();
        const review = spawnSync('claude', ['-p', '--agent', 'goal:goal-run-reviewer', '--permission-mode', 'auto', reviewBrief], { encoding: 'utf8' });
        reporter.record(`${review.stdout}${review.stderr}`);
        reporter.say(`RUN stage=reviewer duration_ms=${Date.now() - reviewStart} exit=${review.status ?? 1}`);

        if ((review.status ?? 1) === 0) {
          reporter.say('RUN the reviewer finished, its answer is in the run log');
        } else {
          reporter.say(`RUN the reviewer exited ${review.status ?? 1}, so the pull request may carry no review`);
        }
      } else {
        reporter.say(`RUN marking the pull request ready failed: ${readyOut}`);
      }
    }

    // A lens is a model, not an exit code: it is asked, its finding is logged beside the run, and
    // nothing about its answer changes what this script does next — it cannot, the work is
    // already landed and pushed. Briefed from every box the plan carries ticked, not from this
    // run's own `landed`, so a plan delivered across several runs is judged whole rather than in
    // the fragment this run happened to land.
    const lensBrief = `Refute the iteration(s) ${ticked.join(' ')} of ${basename(plan)} that the plan now carries ticked.

Does what landed implement each iteration's stated Goal and business rules, or a comfortable
reading of them that happened to make the checks pass? Read the plan's own declarations for
each iteration and the commits on this branch; change nothing.

Answer with a verdict of one sentence per finding and a path:line anchor. Nothing you say blocks
this run: it is advisory only.`;

    const lensStart = Date.now();
    const lens = spawnSync('claude', ['-p', '--agent', 'goal:goal-run-lens', '--permission-mode', 'auto', lensBrief], { encoding: 'utf8' });
    reporter.record(`${lens.stdout}${lens.stderr}`);
    reporter.say(`RUN stage=lens duration_ms=${Date.now() - lensStart} exit=${lens.status ?? 1}`);
    reporter.say('RUN lens findings recorded, advisory only');
  }

  const reportPath = join(dir, 'report.md');
  const auditBrief = `Audit the run that just ended on plan ${basename(plan)} and write its report to
${reportPath}.

Every stage this run timed is recorded as a JSON event in ${jsonl}: read it for what happened and
what each stage cost, per iteration.

Read the other reports already under ${dirname(dir)}/ and say which failures recur across runs
rather than describing this one twice. Do not edit a single line of code, do not stage anything,
and do not judge whether the work was correct — the gate already did that.`;

  const auditStart = Date.now();
  const audit = spawnSync('claude', ['-p', '--agent', 'goal:goal-run-auditor', '--permission-mode', 'auto', auditBrief], { encoding: 'utf8' });
  reporter.record(`${audit.stdout}${audit.stderr}`);
  reporter.say(`RUN stage=auditor duration_ms=${Date.now() - auditStart} exit=${audit.status ?? 1}`);
  reporter.say('RUN audit recorded');

  // Folded into the pull request body the auditor's report has just been written to, never as a
  // comment: the reviewer reads costs, halts and recurrences on the pull request itself.
  if (existsSync(reportPath)) {
    publisher.foldReport?.(readFileSync(reportPath, 'utf8'));
  }

  if (dodExit !== 0) {
    reporter.say('STOP the global Definition of Done refused this run:');
    reporter.say(dodOut);

    return HALTED;
  }

  return LANDED;
};
