// Publication under commit+pr: the first landed iteration pushes to the plan's declared remote
// and opens a draft pull request; every landing after it rewrites the same body. A secret-scanner
// refusal, a fixup commit, a failed push, or a `gh` error blocks publication stickily for the
// rest of this run rather than being retried every iteration.

import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

import { header } from '../gate/plan.ts';
import type { Reporter } from './report.ts';
import type { PublishState } from './close.ts';
import { git } from './shell.ts';

// `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
const repoOf = (remote: string): string =>
  git('remote', 'get-url', remote)
    .stdout.trim()
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');

export type Publisher = {
  publish: (iteration: string) => void;
  foldReport?: (text: string) => void;
  state: PublishState;
};

// Named on the run's own terminal line, whatever the exit, rather than left in an earlier `RUN`
// line a developer skimming straight to the bottom of the log would never reach.
export const blockedNote = (publisher: Publisher): string =>
  publisher.state.blocked ? ` Publication is blocked: ${publisher.state.blockedReason ?? ''}` : '';

export const createPublisher = (
  plan: string,
  source: string,
  policy: string,
  remote: string,
  reporter: Reporter,
  gate: string,
): Publisher => {
  const publishes = policy === 'commit+pr';

  const rawPrBase = header(source, 'PR base:');
  const prBase = rawPrBase !== undefined && /^[A-Za-z0-9._/-]+$/.test(rawPrBase) ? rawPrBase : undefined;

  const planTitle = header(source, '# Spec:') || `Exécution de ${basename(plan)}`;

  let blocked = '';
  let shipped = false;
  const landed: string[] = [];
  const shas = new Map<string, string>();
  const state: PublishState = { publishes, prOpen: false, blocked: false };

  const goalOf = (iteration: string): string | undefined => {
    const lines = source.split('\n');
    const start = lines.findIndex((line) => new RegExp(`^### Iteration ${iteration}\\b`).test(line));

    if (start === -1) {
      return undefined;
    }

    const next = lines.slice(start + 1).findIndex((line) => /^#{2,3} /.test(line));
    const section = lines.slice(start + 1, next === -1 ? lines.length : start + 1 + next);

    const goalStart = section.findIndex((line) => /^- \*\*Goal:\*\*/.test(line));

    if (goalStart === -1) {
      return undefined;
    }

    // Continuation lines fold into the same sentence: a `**Goal:**` bullet reads as one
    // paragraph up to the next `- **` bullet or blank line, never as a truncated first line.
    const goalRest = section.slice(goalStart + 1).findIndex((line) => /^- \*\*/.test(line) || line.trim() === '');
    const goalEnd = goalRest === -1 ? section.length : goalStart + 1 + goalRest;

    return section
      .slice(goalStart, goalEnd)
      .map((line) => line.trim())
      .join(' ')
      .replace(/^- \*\*Goal:\*\* */, '');
  };

  // Iteration 1 of the supervised-PR plan `issue-<N>-spec.md`: a single-issue, single-PR run
  // names its issue in the plan's own filename, so the PR body can close it without guessing
  // an issue number out of the plan's prose.
  const closesIssue = /^issue-(\d+)-spec\.md$/.exec(basename(plan));

  const prBody = (): string => {
    const bullets = landed
      .map((n, i) => {
        const goal = goalOf(n);

        return goal === undefined ? undefined : `${i + 1}. ${goal} ${shas.get(n) ?? ''}`;
      })
      .filter((bullet): bullet is string => bullet !== undefined)
      .join('\n');

    const closes = closesIssue !== null ? `\n\nCloses #${closesIssue[1]}` : '';

    return `## Delivered\n\n${bullets}${closes}\n`;
  };

  // The pull request is opened as a draft at the **first** landed commit, and its body rewritten
  // after every one after it, so a run that halts partway still leaves something a human can
  // read instead of a local branch nobody can see. `blocked` is sticky: once publication fails
  // for any reason it stays failed for the rest of this run rather than retried every iteration.
  const publish = (iteration: string): void => {
    landed.push(iteration);
    shas.set(iteration, git('rev-parse', '--short', 'HEAD').stdout.trim());

    if (blocked !== '') {
      return;
    }

    if (!publishes) {
      blocked = `Policy is ${policy || 'unreadable'}, not commit+pr, so nothing is pushed and no pull request is opened. The commits are on the branch, where the developer asked them to stay.`;

      return;
    }

    // Reshaping happens once, before anything is pushed, and never again: after the first push
    // folding a commit would need a force.
    if (!shipped) {
      const fixups = git('log', '--format=%s', `-${landed.length}`)
        .stdout.split('\n')
        .filter((subject) => /^(fixup|squash)!/.test(subject)).length;

      if (fixups > 0) {
        blocked = 'The run carries a fixup or squash commit, so the history is not the sequence a reviewer should read. Nothing was pushed: fold them yourself, then push.';
        state.blocked = true;
        state.blockedReason = blocked;
        reporter.say(`RUN ${blocked}`);

        return;
      }
    }

    const scan = spawnSync(`${gate} scan`, { shell: true, encoding: 'utf8' });

    if ((scan.status ?? 1) !== 0) {
      blocked = `The secret scanner refused this tree, so nothing was pushed:\n${scan.stdout}${scan.stderr}`;
      state.blocked = true;
      state.blockedReason = blocked;
      reporter.say(`RUN ${blocked}`);

      return;
    }

    const push = git('push', '-u', remote, 'HEAD');

    if (push.status !== 0) {
      blocked = `The push failed:\n${push.stdout}${push.stderr}`;
      state.blocked = true;
      state.blockedReason = blocked;
      reporter.say(`RUN ${blocked}`);

      return;
    }

    shipped = true;
    reporter.say(`RUN pushed to ${remote}`);

    const repo = repoOf(remote);
    const branch = git('branch', '--show-current').stdout.trim();
    const body = prBody();

    // Asked, not assumed, unless already confirmed this run: a run resumed by hand on a single
    // iteration has no memory of what an earlier invocation already opened, so whether a pull
    // request exists is read from `gh` itself the first time this process needs to know.
    if (!state.prOpen) {
      const view = spawnSync('gh', ['pr', 'view', branch, '--repo', repo, '--json', 'number,state'], { encoding: 'utf8' });

      // A merged, closed, or otherwise-not-open pull request still resolves by branch name, so
      // its state is read too: only one reported as OPEN is edited, or this run's iterations
      // land where a reviewer already stopped looking. Allowlisted rather than denylisted, so a
      // `gh` state this code does not yet know reads as not-open instead of open.
      try {
        const parsed = JSON.parse(view.stdout) as { number?: unknown; state?: unknown };

        if ((view.status ?? 1) === 0 && typeof parsed.number === 'number' && parsed.state === 'OPEN') {
          state.prOpen = true;
        }
      } catch {}
    }

    const gh = state.prOpen
      ? spawnSync('gh', ['pr', 'edit', branch, '--repo', repo, '--body', body], { encoding: 'utf8' })
      : prBase !== undefined
        ? spawnSync('gh', ['pr', 'create', '--repo', repo, '--draft', '--base', prBase, '--title', planTitle, '--body', body], { encoding: 'utf8' })
        : spawnSync('gh', ['pr', 'create', '--repo', repo, '--draft', '--title', planTitle, '--body', body], { encoding: 'utf8' });

    if ((gh.status ?? 1) === 0) {
      if (state.prOpen) {
        reporter.say('RUN rewrote the pull request body');
      } else {
        state.prOpen = true;
        reporter.say(prBase !== undefined ? `RUN opened a draft pull request against ${prBase}` : 'RUN opened a draft pull request');
      }

      return;
    }

    blocked = `${gh.stdout}${gh.stderr}`;
    state.blocked = true;
    state.blockedReason = blocked;
    reporter.say(`RUN ${blocked}`);
  };

  // The auditor's report, folded into the same body-rewrite path as every other landing: no
  // comment, no separate channel, and a rerun on the same pull request replaces the section
  // rather than stacking another one beside it, since the whole body is recomputed every time.
  const foldReport = (text: string): void => {
    if (!state.publishes || !state.prOpen) {
      return;
    }

    const repo = repoOf(remote);
    const branch = git('branch', '--show-current').stdout.trim();
    const gh = spawnSync('gh', ['pr', 'edit', branch, '--repo', repo, '--body', `${prBody()}\n---\n\n## Run report\n\n${text}\n`], { encoding: 'utf8' });

    if ((gh.status ?? 1) === 0) {
      reporter.say('RUN folded the run report into the pull request body');
    } else {
      reporter.say(`RUN failed to fold the run report into the pull request body: ${gh.stdout}${gh.stderr}`);
    }
  };

  return { publish, foldReport, state };
};
