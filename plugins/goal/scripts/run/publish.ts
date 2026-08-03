// Publication under commit+pr: the first landed iteration pushes to the plan's declared remote
// and opens a draft pull request; every landing after it rewrites the same body. A secret-scanner
// refusal, a fixup commit, a failed push, an unquotable title or a `gh` error blocks publication
// stickily for the rest of this run rather than being retried every iteration.

import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

import { header, iterationHeading } from '../gate/plan.ts';
import type { Reporter } from './report.ts';
import type { PublishState } from './close.ts';

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });

// `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
const repoOf = (remote: string): string =>
  git('remote', 'get-url', remote)
    .stdout.trim()
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');

export type Publisher = {
  publish: (iteration: string) => void;
  state: PublishState;
};

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
  const state: PublishState = { publishes, prOpen: false, blocked: false };

  const prBody = (): string => {
    const headings = landed
      .map((n) => iterationHeading(source, n))
      .filter((heading): heading is string => heading !== undefined)
      .map((heading) => heading.replace(/^### /, '- '))
      .join('\n');

    return `## Landed\n\n${headings}\n\nEach iteration was judged by the gate before its commit: declared scope, diff budget, removals, acceptance commands, and the bite check that requires the test to fail without the implementation. No commit exists that a gate did not verify.\n`;
  };

  // The pull request is opened as a draft at the **first** landed commit, and its body rewritten
  // after every one after it, so a run that halts partway still leaves something a human can
  // read instead of a local branch nobody can see. `blocked` is sticky: once publication fails
  // for any reason it stays failed for the rest of this run rather than retried every iteration.
  const publish = (iteration: string): void => {
    landed.push(iteration);

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
        reporter.say(`RUN ${blocked}`);

        return;
      }
    }

    const scan = spawnSync(`${gate} scan`, { shell: true, encoding: 'utf8' });

    if ((scan.status ?? 1) !== 0) {
      blocked = `The secret scanner refused this tree, so nothing was pushed:\n${scan.stdout}${scan.stderr}`;
      state.blocked = true;
      reporter.say(`RUN ${blocked}`);

      return;
    }

    const push = git('push', '-u', remote, 'HEAD');

    if (push.status !== 0) {
      blocked = `The push failed:\n${push.stdout}${push.stderr}`;
      state.blocked = true;
      reporter.say(`RUN ${blocked}`);

      return;
    }

    shipped = true;
    reporter.say(`RUN pushed to ${remote}`);

    if (/['\\]/.test(planTitle)) {
      blocked = `The plan's title cannot be safely quoted for a pull request — it contains a quote or a backslash: ${planTitle}. Rename its "# Spec:" line, then relaunch; the branch is already pushed.`;
      state.blocked = true;
      reporter.say(`RUN ${blocked}`);

      return;
    }

    const repo = repoOf(remote);
    const branch = git('branch', '--show-current').stdout.trim();
    const body = prBody();

    // Asked, not assumed, unless already confirmed this run: a run resumed by hand on a single
    // iteration has no memory of what an earlier invocation already opened, so whether a pull
    // request exists is read from `gh` itself the first time this process needs to know.
    if (!state.prOpen) {
      const view = spawnSync('gh', ['pr', 'view', branch, '--repo', repo, '--json', 'number,state'], { encoding: 'utf8' });

      // A merged or closed pull request still resolves by branch name, so its state is read
      // too: only one still open is edited, or this run's iterations land where a reviewer
      // already stopped looking.
      if ((view.status ?? 1) === 0 && /"number":\d+/.test(view.stdout) && !/"state":"(MERGED|CLOSED)"/.test(view.stdout)) {
        state.prOpen = true;
      }
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
    reporter.say(`RUN ${blocked}`);
  };

  return { publish, state };
};
