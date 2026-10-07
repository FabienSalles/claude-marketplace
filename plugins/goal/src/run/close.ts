// The closing stage: replayed once every requested iteration has landed, gate-verified. A pass
// marks the run's own open pull request ready — never one `gh` merely reports, since that could
// belong to an earlier run — and the advisory lens and the auditor are invoked either way,
// neither able to undo work the gate already verified and shipped.

import { basename, dirname, join } from 'node:path';

import { command } from '../adapters/command.ts';
import { clock } from '../adapters/clock.ts';
import { fs } from '../adapters/fs.ts';
import { gateAdapterOf, type GateAdapter } from '../adapters/gate.ts';
import { git } from '../adapters/git.ts';
import { header, iterationNumbers, readPlan } from '../gate/plan.ts';
import { HALTED, LANDED, PAUSED } from '../core/verdict.ts';
import { pauseLine, readyPauseLine } from '../core/publication.ts';
import type { AgentReport, AgentRole, AgentSessions } from '../ports.ts';
import { endOf, exitOf, tokensLine } from './narrate.ts';
import { remoteNote, repoOf, repoRelative, type Publisher } from './publish.ts';
import type { Reporter } from './report.ts';

export { HALTED, LANDED } from '../core/verdict.ts';

const readOrEmpty = (path: string): string => (fs.exists(path) ? fs.readFile(path) : '');

const launchAdvisory = (agents: AgentSessions, role: AgentRole, brief: string, dir: string): Promise<AgentReport> =>
  agents.launch(role, brief, { outPath: join(dir, `${role}.out`), errPath: join(dir, `${role}.err`), onTool: () => {}, onSession: () => {} }, new AbortController().signal);

export const close = async (
  plan: string,
  gateArg: GateAdapter | string,
  hash: string,
  remote: string,
  publisher: Publisher,
  landed: string[],
  dir: string,
  reporter: Reporter,
  agents: AgentSessions,
): Promise<number> => {
  const gate = gateAdapterOf(gateArg);
  const jsonl = join(dir, '.run.jsonl');
  const dodStart = clock.now();
  const dod = gate.dod(plan, hash);
  const dodOut = `${dod.stdout}${dod.stderr}`;
  const dodExit = dod.status;
  reporter.say(`RUN stage=dod duration_ms=${clock.now() - dodStart} exit=${dodExit}`);

  // The plan on disk, re-read here rather than trusted from before this run started: every box
  // the gate ticked, this run's own or an earlier run's, is on it now.
  const source = readPlan(plan);
  const ticked = iterationNumbers(source, true);
  const postsReview = header(source, 'Review:') === 'comment';

  if (dodExit === 0) {
    // The last iteration's own push, held back until now: nothing this run committed reaches the
    // remote until the whole-branch Definition of Done says so. A close with nothing landed in
    // this invocation publishes what an earlier one left behind.
    const pushStart = clock.now();
    const refusal = publisher.publish(landed[landed.length - 1]);
    reporter.say(`RUN stage=push duration_ms=${clock.now() - pushStart} exit=${refusal === undefined ? 0 : 1}`);

    if (refusal !== undefined) {
      reporter.say(`STOP ${pauseLine(refusal, publisher.state.landed, publisher.state.onRemote)}`);

      return PAUSED;
    }

    reporter.say('RUN the global Definition of Done passed');
    const repo = repoOf(remote);
    const publish = publisher.state;
    let branch = '';
    let reviewBrief: string | undefined;

    if (publish.publishes && publish.prOpen) {
      branch = git('branch', '--show-current').stdout.trim();
      const readyStart = clock.now();
      const ready = command.run('gh', ['pr', 'ready', '--repo', repo, branch]);
      const readyOut = `${ready.stdout}${ready.stderr}`;
      reporter.say(`RUN stage=pull-request-update duration_ms=${clock.now() - readyStart} exit=${ready.status ?? 1}`);

      if ((ready.status ?? 1) === 0) {
        reporter.say('RUN the pull request was marked ready');

        // The reviewer runs at the one moment publication cannot still be blocked behind it: the
        // pull request just went ready. It comments, never `REQUEST_CHANGES` — pushed work is
        // already shipped, and a review that cannot block would only add friction to clear by
        // hand.
        reviewBrief = `Review the pull request for ${branch} on ${repo}, carrying iteration(s) ${ticked.join(' ')} of ${basename(plan)}, which was just marked ready for review.

Read the plan's own declarations for each landed iteration and the commits on this branch, then
write one review with inline comments: design, error handling, security posture, and this
project's own conventions — the reading a gate is not built to give.

Paths are relative to the repository root; name every file that way in what you write, never by an absolute path.

${postsReview
  ? 'This plan carries a `Review: comment` header, opting into posting. Post it with `gh` as a comment review, never `REQUEST_CHANGES`: nothing you post can block a pull request that already shipped. Open the review with a banner stating plainly that it is the output of the goal-run-reviewer AI agent, never written as if the developer authored it.'
  : 'This plan carries no `Review: comment` header. Do not post it to GitHub: return your review as text, so it reaches the developer through the run log only.'}`;
      } else {
        reporter.say(`RUN marking the pull request ready failed: ${readyOut}`);
        reporter.say(`STOP ${readyPauseLine(readyOut, publisher.state.landed, publisher.state.onRemote)}`);

        return PAUSED;
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

    // Run once neither can still block anything and each is briefed: the reviewer against a mark
    // pull requests only lands whole, after both have exited, so an advisory duration is paid
    // once instead of twice.
    const jobs: { name: 'lens' | 'reviewer'; brief: string }[] = [{ name: 'lens', brief: lensBrief }];

    if (reviewBrief !== undefined) {
      jobs.push({ name: 'reviewer', brief: reviewBrief });
    }

    fs.mkdir(dir, { recursive: true });
    const advisoryStart = clock.now();
    const reports = await Promise.all(jobs.map((job) => launchAdvisory(agents, job.name, job.brief, dir)));
    const advisoryDuration = clock.now() - advisoryStart;

    jobs.forEach((job, i) => {
      const report = reports[i]!;
      reporter.record(report.outcome.text);
      reporter.say(`RUN stage=${job.name} duration_ms=${advisoryDuration} ${endOf(report.end)}`);

      const tokens = tokensLine(job.name, report.consumption);

      if (tokens !== undefined && tokens !== '') {
        reporter.say(tokens);
      }

      const stderr = readOrEmpty(report.errPath);

      if (stderr.trim() !== '') {
        reporter.say(`RUN diagnostics stage=${job.name}: ${stderr.trim()}`);
      }

      if (job.name === 'reviewer') {
        const status = exitOf(report.end);

        if (status === 0) {
          reporter.say('RUN the reviewer finished, its answer is in the run log');
        } else {
          reporter.say(`RUN the reviewer exited ${status}, so the pull request may carry no review`);
        }
      }
    });

    reporter.say('RUN lens findings recorded, advisory only');
  }

  const reportPath = join(dir, 'report.md');
  const auditBrief = `Audit the run that just ended on plan ${basename(plan)} and write its report to
${repoRelative(reportPath)}.

Every stage this run timed is recorded as a JSON event in ${repoRelative(jsonl)}: read it for what happened and
what each stage cost, per iteration.

Paths are relative to the repository root; name every file that way in what you write, never by an absolute path.

Read the other reports already under ${repoRelative(dirname(dir))}/ and say which failures recur across runs
rather than describing this one twice. Write it in two sections, \`### Outcome\` then
\`### Cost\`, no other heading anywhere in the file. Do not edit a single line of code, do
not stage anything, and do not judge whether the work was correct — the gate already did that.`;

  const auditStart = clock.now();
  fs.mkdir(dir, { recursive: true });
  const audit = await launchAdvisory(agents, 'auditor', auditBrief, dir);
  reporter.record(audit.outcome.text);
  reporter.say(`RUN stage=auditor duration_ms=${clock.now() - auditStart} ${endOf(audit.end)}`);

  const auditTokens = tokensLine('auditor', audit.consumption);

  if (auditTokens !== undefined && auditTokens !== '') {
    reporter.say(auditTokens);
  }

  const auditStderr = readOrEmpty(audit.errPath);

  if (auditStderr.trim() !== '') {
    reporter.say(`RUN diagnostics stage=auditor: ${auditStderr.trim()}`);
  }

  reporter.say('RUN audit recorded');

  // Folded into the pull request body the auditor's report has just been written to, never as a
  // comment: the reviewer reads costs, halts and recurrences on the pull request itself.
  if (fs.exists(reportPath)) {
    publisher.foldReport?.(fs.readFile(reportPath), plan, dir);
  }

  if (dodExit !== 0) {
    publisher.refresh?.(landed[landed.length - 1]);

    if (dodExit !== 1) {
      reporter.say(`STOP the global Definition of Done could not be run (exit ${dodExit}), so no verdict exists:${remoteNote(publisher)}`);
      reporter.say(dodOut);

      return PAUSED;
    }

    reporter.say(`STOP the global Definition of Done refused this run:${remoteNote(publisher)}`);
    reporter.say(dodOut);

    return HALTED;
  }

  return LANDED;
};
