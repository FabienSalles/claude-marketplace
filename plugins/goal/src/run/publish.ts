// Publication under commit+pr: the first landed iteration pushes to the plan's declared remote
// and opens a draft pull request; every landing after it rewrites the same body. A secret-scanner
// refusal, a fixup commit, a failed push, a closed pull request or a `gh` error is returned as a
// refusal, and the caller pauses the run there.

import { realpathSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';

import { gateAdapterOf, type GateAdapter } from '../adapters/gate.ts';
import { command } from '../adapters/command.ts';
import { git } from '../adapters/git.ts';
import { fs } from '../adapters/fs.ts';
import { gateFence, goalOf } from '../core/plan.ts';
import { deliveredList, onRemoteOf, prDecision, prIsReady, remoteStatus, type CommitRef, type PlanEntry } from '../core/publication.ts';
import { header, iterationNumbers, iterationSection } from '../gate/plan.ts';
import type { Reporter } from './report.ts';

// What run/close.ts reads instead of asking `gh` for the pull request's own state: whether this
// run's policy publishes at all, whether this run opened or found one, and which landed
// iterations the remote holds.
export type PublishState = {
  publishes: boolean;
  prOpen: boolean;
  landed: string[];
  onRemote: string[];
};

// `gh` needs owner/name, git gives a URL: SSH, HTTPS, with or without the `.git` suffix.
export const repoOf = (remote: string): string =>
  git('remote', 'get-url', remote)
    .stdout.trim()
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');

const realOf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

export const repoRelative = (path: string): string => {
  const top = git('rev-parse', '--show-toplevel').stdout.trim();

  return top === '' ? path : relative(realOf(top), realOf(path));
};

export const unpushedSubjects = (remote: string): string[] =>
  git('log', '--format=%s', 'HEAD', '--not', `--remotes=${remote}`)
    .stdout.split('\n')
    .filter((subject) => subject !== '');

export type Publisher = {
  isComplete: () => boolean;
  publish: (iteration?: string) => string | undefined;
  refresh?: (iteration?: string) => void;
  foldReport?: (text: string, plan: string, dir: string) => void;
  state: PublishState;
};

export const remoteNote = (publisher: Publisher): string => ` ${remoteStatus(publisher.state.landed, publisher.state.onRemote)}`;

export const createPublisher = (
  plan: string,
  source: string,
  policy: string,
  remote: string,
  reporter: Reporter,
  gateArg: GateAdapter | string,
): Publisher => {
  const gate = gateAdapterOf(gateArg);
  const publishes = policy === 'commit+pr';

  const rawPrBase = header(source, 'PR base:');
  const prBase = rawPrBase !== undefined && /^[A-Za-z0-9._/-]+$/.test(rawPrBase) ? rawPrBase : undefined;

  const specTitle = header(source, '# Spec:');
  const planTitle = specTitle !== undefined && specTitle !== '' ? specTitle : `Run of ${basename(plan)}`;

  const inRun = new Map<string, string>();
  const state: PublishState = { publishes, prOpen: false, landed: [], onRemote: [] };

  // Iteration 1 of the supervised-PR plan `issue-<N>-spec.md`: a single-issue, single-PR run
  // names its issue in the plan's own filename, so the PR body can close it without guessing
  // an issue number out of the plan's prose.
  const closesIssue = /^issue-(\d+)-spec\.md$/.exec(basename(plan));

  const planSource = (): string => (fs.exists(plan) && fs.isFile(plan) ? fs.readFile(plan) : source);

  const commitSubject = (text: string, n: string): string =>
    (gateFence(iterationSection(text, n)) ?? []).find((line) => line.startsWith('commit_msg='))?.slice('commit_msg='.length).trim() ?? '';

  const entries = (): PlanEntry[] => {
    const text = planSource();
    const numbers = [...new Set([...iterationNumbers(text, true), ...inRun.keys()])].sort((a, b) => Number(a) - Number(b));

    return numbers.map((number) => ({ number, goal: goalOf(text, number) ?? '', subject: commitSubject(text, number), sha: inRun.get(number) }));
  };

  const commitLog = (): CommitRef[] =>
    git('log', '--format=%H %s')
      .stdout.split('\n')
      .filter((line) => line !== '')
      .map((line) => ({ sha: line.slice(0, line.indexOf(' ')), subject: line.slice(line.indexOf(' ') + 1) }));

  const refresh = (branch: string, log: readonly CommitRef[]): void => {
    const listed = entries();
    const remoteShas = publishes ? git('rev-list', `${remote}/${branch}`).stdout.split('\n').filter((sha) => sha !== '') : [];
    state.landed.splice(0, state.landed.length, ...listed.map((entry) => entry.number));
    state.onRemote.splice(0, state.onRemote.length, ...onRemoteOf(listed, log, remoteShas));
  };

  const isComplete = (): boolean => {
    if (!publishes) {
      return true;
    }

    const branch = git('branch', '--show-current').stdout.trim();
    refresh(branch, commitLog());

    if (state.landed.some((n) => !state.onRemote.includes(n))) {
      return false;
    }

    const view = command.run('gh', ['pr', 'view', branch, '--repo', repoOf(remote), '--json', 'number,state,isDraft']);

    return prIsReady(view.status, view.stdout);
  };

  const prBody = (): string => {
    const closes = closesIssue !== null ? `\n\nCloses #${closesIssue[1]}` : '';

    return `## Delivered\n\n${deliveredList(
      entries().filter((entry) => entry.goal !== ''),
      commitLog(),
    )}${closes}\n`;
  };

  // The pull request is opened as a draft at the **first** landed commit, and its body rewritten
  // after every one after it, so a run that halts partway still leaves something a human can
  // read instead of a local branch nobody can see. A refusal is returned as its reason, never
  // swallowed: the caller pauses the run at that boundary.
  const record = (iteration?: string): string => {
    if (iteration !== undefined) {
      inRun.set(iteration, git('rev-parse', 'HEAD').stdout.trim());
    }

    const branch = git('branch', '--show-current').stdout.trim();
    refresh(branch, commitLog());

    return branch;
  };

  const publish = (iteration?: string): string | undefined => {
    const branch = record(iteration);

    if (!publishes) {
      reporter.say(`RUN Policy is ${policy !== '' ? policy : 'unreadable'}, not commit+pr, so nothing leaves this machine and no pull request is opened. The commits are on the branch, where the developer asked them to stay.`);

      return undefined;
    }

    if (unpushedSubjects(remote).some((subject) => /^(fixup|squash)!/.test(subject))) {
      return 'The run carries a fixup or squash commit, so the history is not the sequence a reviewer should read. Nothing was pushed: fold them yourself, then push.';
    }

    const scan = gate.scan();

    if (scan.status !== 0) {
      return `The secret scanner refused this tree, so nothing was pushed:\n${scan.stdout}${scan.stderr}`;
    }

    const repo = repoOf(remote);

    if (!state.prOpen) {
      const view = command.run('gh', ['pr', 'view', branch, '--repo', repo, '--json', 'number,state']);
      const decision = prDecision(view.status, view.stdout, view.stderr);

      if (decision.kind === 'pause') {
        return decision.reason;
      }

      state.prOpen = decision.kind === 'edit';
    }

    const push = git('push', '-u', remote, 'HEAD');

    if (push.status !== 0) {
      return `The push failed:\n${push.stdout}${push.stderr}`;
    }

    refresh(branch, commitLog());
    reporter.say(`RUN pushed to ${remote}`);

    const body = prBody();

    const gh = state.prOpen
      ? command.run('gh', ['pr', 'edit', branch, '--repo', repo, '--body', body])
      : prBase !== undefined
        ? command.run('gh', ['pr', 'create', '--repo', repo, '--draft', '--base', prBase, '--title', planTitle, '--body', body])
        : command.run('gh', ['pr', 'create', '--repo', repo, '--draft', '--title', planTitle, '--body', body]);

    if ((gh.status ?? 1) === 0) {
      if (state.prOpen) {
        reporter.say('RUN rewrote the pull request body');
      } else {
        state.prOpen = true;
        reporter.say(prBase !== undefined ? `RUN opened a draft pull request against ${prBase}` : 'RUN opened a draft pull request');
      }

      return undefined;
    }

    return `The pull request was not ${state.prOpen ? 'updated' : 'created'}:\n${gh.stdout}${gh.stderr}`;
  };

  // The auditor's report, folded into the same body-rewrite path as every other landing: no
  // comment, no separate channel, and a rerun on the same pull request replaces the section
  // rather than stacking another one beside it, since the whole body is recomputed every time.
  // `text` is carried verbatim, and the body ends with a `*Plan and logs (local, gitignored):*`
  // line followed by one bullet per path, learned from the caller rather than guessed here.
  const foldReport = (text: string, plan: string, dir: string): void => {
    if (!state.publishes || !state.prOpen) {
      return;
    }

    const repo = repoOf(remote);
    const branch = git('branch', '--show-current').stdout.trim();
    const footer = `*Plan and logs (local, gitignored):*\n- \`${repoRelative(plan)}\`\n- \`${repoRelative(dir)}\`\n`;
    const gh = command.run('gh', ['pr', 'edit', branch, '--repo', repo, '--body', `${prBody()}\n---\n\n## Run report\n\n${text}\n${footer}`]);

    if ((gh.status ?? 1) === 0) {
      reporter.say('RUN folded the run report into the pull request body');
    } else {
      reporter.say(`RUN failed to fold the run report into the pull request body: ${gh.stdout}${gh.stderr}`);
    }
  };

  return { isComplete, publish, refresh: (iteration) => void record(iteration), foldReport, state };
};
