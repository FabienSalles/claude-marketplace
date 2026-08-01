// The closing stage: replayed once every requested iteration has landed, gate-verified. A pass
// marks the run's own open pull request ready — never one `gh` merely reports, since that could
// belong to an earlier run — and the advisory lens and the auditor are invoked either way,
// neither able to undo work the gate already verified and shipped.

import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

import type { Reporter } from './report.ts';

export const LANDED = 0;
export const HALTED = 1;

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

// `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
const repoOf = (remote: string): string =>
  git('remote', 'get-url', remote)
    .stdout.trim()
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');

// What close() reads instead of asking `gh` for the pull request's own state: whether this run's
// policy publishes at all, whether this run opened or found one, and whether publication ever
// blocked — the shape of goal-run.sh:544, threaded from run/publish.ts's own bookkeeping.
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
  publish: PublishState,
  landed: string[],
  elapsed: string,
  reporter: Reporter,
): number => {
  const dod = spawnSync(`${gate} dod ${quote(plan)} ${quote(hash)}`, { shell: true, encoding: 'utf8' });
  const dodOut = `${dod.stdout}${dod.stderr}`;
  const dodExit = dod.status ?? 1;

  if (dodExit === 0) {
    reporter.say('RUN the global Definition of Done passed');

    if (publish.publishes && publish.prOpen && !publish.blocked) {
      const branch = git('branch', '--show-current').stdout.trim();
      const ready = spawnSync('gh', ['pr', 'ready', '--repo', repoOf(remote), branch], { encoding: 'utf8' });
      const readyOut = `${ready.stdout}${ready.stderr}`;

      if ((ready.status ?? 1) === 0) {
        reporter.say('RUN the pull request was marked ready');
      } else {
        reporter.say(`RUN marking the pull request ready failed: ${readyOut}`);
      }
    }

    // A lens is a model, not an exit code: it is asked, its finding is logged beside the run, and
    // nothing about its answer changes what this script does next — it cannot, the work is
    // already landed and pushed.
    const lensBrief = `Refute the iteration(s) ${landed.join(' ')} of ${basename(plan)} that this run just landed.

Does what landed implement each iteration's stated Goal and business rules, or a comfortable
reading of them that happened to make the checks pass? Read the plan's own declarations for
each iteration and the commits on this branch; change nothing.

Answer with a verdict of one sentence per finding and a path:line anchor. Nothing you say blocks
this run: it is advisory only.`;

    spawnSync('claude', ['-p', '--agent', 'goal:goal-run-lens', '--permission-mode', 'auto', lensBrief], { encoding: 'utf8' });
    reporter.say('RUN lens findings recorded, advisory only');
  }

  const sha = git('rev-parse', '--short', 'HEAD').stdout.trim() || 'unknown';

  const auditBrief = `Audit the run that just ended on plan ${basename(plan)} and write its report to
.claude/goal-runs/${sha}.md.

Elapsed seconds per iteration entered:
${elapsed}
Read the reports already in .claude/goal-runs/ and say which failures recur across runs rather
than describing this one twice. Do not edit a single line of code, do not stage anything, and do
not judge whether the work was correct — the gate already did that.`;

  spawnSync('claude', ['-p', '--agent', 'goal:goal-run-auditor', '--permission-mode', 'auto', auditBrief], { encoding: 'utf8' });
  reporter.say('RUN audit recorded');

  if (dodExit !== 0) {
    reporter.say('STOP the global Definition of Done refused this run:');
    reporter.say(dodOut);

    return HALTED;
  }

  return LANDED;
};
