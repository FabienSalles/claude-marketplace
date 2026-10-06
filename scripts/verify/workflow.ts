import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type * as Yaml from 'yaml';

import { GROUPS, OPT_IN } from './groups.ts';

type Json = Record<string, unknown>;

const WORKFLOW = join('.github', 'workflows', 'validate.yml');

export const CLAUDE_PIN = '2.1.285';

const LATEST_CLAUDE = 'npm install -g @anthropic-ai/claude-code';

const PINNED_CLAUDE = `${LATEST_CLAUDE}@${CLAUDE_PIN}`;

const SETUP_NODE = 'actions/setup-node';

const PINNED_NODE: Json = { 'node-version-file': '.nvmrc' };

const LATEST_NODE: Json = { 'node-version': '24' };

const NVMRC = '.nvmrc';

const EXACT_NODE = /^24\.\d+\.\d+\n$/;

const CLAUDE_GROUP = 'plugin-validate';

const MATRIX_GROUP = 'shell-suites';

const ENTRY = /^node scripts\/verify\.ts ([a-z-]+)$/;

const SCHEDULE_ONLY = /^\s*github\.event_name\s*==\s*'schedule'\s*$/;

const WORKFLOW_KEYS: readonly string[] = ['name', 'on', 'concurrency', 'jobs'];

const JOB_KEYS: readonly string[] = ['name', 'runs-on', 'strategy', 'steps', 'timeout-minutes'];

const STEP_KEYS: readonly string[] = ['name', 'uses', 'with', 'run'];

const TRIGGERS: Json = { push: { branches: ['main'] }, pull_request: { branches: ['main'] } };

const CONCURRENCY: Json = {
  group: '${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}',
  'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
};

const PULL_REQUEST_RUNNER = 'ubuntu-24.04';

const CANARY_RUNNER = 'ubuntu-latest';

const MATRIX_RUNNER = '${{ matrix.os }}';

const MACOS_RUNNER = /^macos-\d+$/;

const MAX_TIMEOUT_MINUTES = 15;

const CANARY_PERMISSIONS: Json = { contents: 'read', issues: 'write' };

const CANARY_REPORT: Json = {
  if: 'failure()',
  env: { GH_TOKEN: '${{ github.token }}' },
  run: [
    'run_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"',
    `issue=$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search 'in:title canary' --json number,title --jq '[.[] | select(.title == "Canary failed")][0].number // empty')`,
    'if [ -n "$issue" ]; then',
    '  gh issue comment "$issue" --repo "$GITHUB_REPOSITORY" --body "The canary failed again: $run_url"',
    'else',
    '  gh issue create --repo "$GITHUB_REPOSITORY" --title "Canary failed" --body "The canary failed: $run_url"',
    'fi',
  ].join('\n'),
};

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

const describe = (step: Json): string => {
  for (const label of [step['name'], step['run'], step['uses']]) {
    if (typeof label === 'string') {
      return label.trim();
    }
  }

  return 'unnamed step';
};

const entryGroup = (step: Json): string | undefined =>
  typeof step['run'] === 'string' ? ENTRY.exec(step['run'].trim())?.[1] : undefined;

const isCanaryReport = (step: Json): boolean => {
  const { name, run, ...rest } = step;

  return (name === undefined || typeof name === 'string') && typeof run === 'string' && isDeepStrictEqual({ ...rest, run: run.trim() }, CANARY_REPORT);
};

const extraKeys = (record: Json, allowed: readonly string[]): readonly string[] => Object.keys(record).filter((key) => !allowed.includes(key));

const endsWithOneReport = (steps: readonly Json[]): boolean => steps.filter(isCanaryReport).length === 1 && isCanaryReport(steps.at(-1) ?? {});

const timeoutFinding = (timeout: unknown): string | undefined => {
  if (typeof timeout !== 'number' || timeout <= 0) {
    return 'declares no timeout-minutes';
  }

  return timeout > MAX_TIMEOUT_MINUTES ? `sets timeout-minutes to ${timeout}, above the ${MAX_TIMEOUT_MINUTES}-minute cap` : undefined;
};

const isMacMatrix = (strategy: unknown): boolean => {
  const os = isRecord(strategy) && isRecord(strategy['matrix']) ? strategy['matrix']['os'] : undefined;

  return (
    Array.isArray(os) &&
    os.length === 2 &&
    os[0] === PULL_REQUEST_RUNNER &&
    typeof os[1] === 'string' &&
    MACOS_RUNNER.test(os[1]) &&
    isDeepStrictEqual(strategy, { 'fail-fast': false, matrix: { os } })
  );
};

const runnerFinding = (job: Json, scheduled: boolean, group: string | undefined): string | undefined => {
  if (!scheduled && group === MATRIX_GROUP) {
    return job['runs-on'] === MATRIX_RUNNER && isMacMatrix(job['strategy'])
      ? undefined
      : `must run on ${MATRIX_RUNNER} over fail-fast: false and os: [${PULL_REQUEST_RUNNER}, macos-<version>]`;
  }

  const runner = scheduled ? CANARY_RUNNER : PULL_REQUEST_RUNNER;

  return job['runs-on'] === runner && job['strategy'] === undefined ? undefined : `must run on ${runner} with no strategy`;
};

const actionRefusal = (uses: string, inputs: Json, scheduled: boolean): string | undefined => {
  const action = uses.split('@')[0];

  if (action === 'actions/checkout') {
    return Object.keys(inputs).length === 0 ? undefined : 'checkout takes no input';
  }

  if (action === SETUP_NODE && scheduled) {
    return isDeepStrictEqual(inputs, LATEST_NODE) ? undefined : "setup-node in the canary job must float on node-version: '24'";
  }

  if (action === SETUP_NODE) {
    return isDeepStrictEqual(inputs, PINNED_NODE) ? undefined : 'setup-node in a pull-request job must read node-version-file: .nvmrc';
  }

  if (action === 'astral-sh/setup-uv') {
    return scheduled && Object.keys(inputs).length === 0 ? undefined : 'setup-uv runs only in the canary job, with no input';
  }

  return 'not an allowed setup action';
};

const stepRefusal = (step: Json, scheduled: boolean, group: string | undefined): string | undefined => {
  if (scheduled && isCanaryReport(step)) {
    return undefined;
  }

  const extra = extraKeys(step, STEP_KEYS);

  if (extra.length > 0) {
    return `carries ${extra.join(', ')}; a step carries only ${STEP_KEYS.join(', ')}`;
  }

  if (typeof step['uses'] === 'string') {
    return actionRefusal(step['uses'], isRecord(step['with']) ? step['with'] : {}, scheduled);
  }

  if (typeof step['run'] !== 'string') {
    return 'neither an action nor a command';
  }

  const command = step['run'].trim();
  const named = entryGroup(step);

  if (command === PINNED_CLAUDE) {
    return !scheduled && group === CLAUDE_GROUP ? undefined : `the pinned Claude Code install runs only in the ${CLAUDE_GROUP} job`;
  }

  if (command === LATEST_CLAUDE) {
    return scheduled ? undefined : 'the latest Claude Code install runs only in the canary job';
  }

  if (named === undefined) {
    return 'not a setup step nor the entry';
  }

  return GROUPS.includes(named) ? undefined : `unknown group ${named}`;
};

const jobFindings = (id: string, job: Json): readonly string[] => {
  const scheduled = typeof job['if'] === 'string' && SCHEDULE_ONLY.test(job['if']);
  const steps = (Array.isArray(job['steps']) ? job['steps'] : []).filter(isRecord);
  const entries = steps.flatMap((step) => entryGroup(step) ?? []);
  const where = `${WORKFLOW}: job ${id}`;
  const timeout = timeoutFinding(job['timeout-minutes']);
  const runner = runnerFinding(job, scheduled, entries[0]);
  const nodeSetups = steps.filter((step) => typeof step['uses'] === 'string' && step['uses'].split('@')[0] === SETUP_NODE).length;
  const claude = scheduled ? LATEST_CLAUDE : entries[0] === CLAUDE_GROUP ? PINNED_CLAUDE : undefined;
  const claudeInstalls = steps.filter((step) => typeof step['run'] === 'string' && step['run'].trim() === claude).length;

  return [
    ...extraKeys(job, scheduled ? [...JOB_KEYS, 'if', 'permissions'] : JOB_KEYS).map(
      (key) => `${where} carries ${key}; a job carries only ${JOB_KEYS.join(', ')}, plus the canary job's schedule condition and permissions`,
    ),
    ...(timeout === undefined ? [] : [`${where} ${timeout}`]),
    ...(runner === undefined ? [] : [`${where} ${runner}`]),
    ...(scheduled && !isDeepStrictEqual(job['permissions'], CANARY_PERMISSIONS)
      ? [`${where} must ask for exactly ${JSON.stringify(CANARY_PERMISSIONS)}`]
      : []),
    ...(scheduled && !endsWithOneReport(steps) ? [`${where} must end with exactly one canary failure report step`] : []),
    ...(entries.length === 1 ? [] : [`${where} runs the entry ${entries.length} times instead of once`]),
    ...(nodeSetups === 1 ? [] : [`${where} sets up Node ${nodeSetups} times instead of once`]),
    ...(claude === undefined || claudeInstalls === 1 ? [] : [`${where} must install Claude Code with "${claude}" exactly once`]),
    ...steps.flatMap((step) => {
      const reason = stepRefusal(step, scheduled, entries[0]);

      return reason === undefined ? [] : [`${where}, step "${describe(step)}": ${reason}`];
    }),
  ];
};

const isOneCron = (schedule: unknown): boolean =>
  Array.isArray(schedule) &&
  schedule.length === 1 &&
  isRecord(schedule[0]) &&
  Object.keys(schedule[0]).length === 1 &&
  typeof schedule[0]['cron'] === 'string';

const triggerFindings = (on: unknown): readonly string[] => {
  if (!isRecord(on)) {
    return [`${WORKFLOW} must trigger on a map of push, pull_request and schedule`];
  }

  return [
    ...extraKeys(on, [...Object.keys(TRIGGERS), 'schedule']).map(
      (key) => `${WORKFLOW} triggers on ${key}; only push, pull_request and schedule are allowed`,
    ),
    ...Object.entries(TRIGGERS).flatMap(([event, shape]) => {
      if (on[event] === undefined) {
        return [`${WORKFLOW} never runs on ${event}`];
      }

      return isDeepStrictEqual(on[event], shape)
        ? []
        : [`${WORKFLOW}: on.${event} must be exactly ${JSON.stringify(shape)}, or a filter could keep its jobs from running`];
    }),
    ...(on['schedule'] === undefined
      ? [`${WORKFLOW} never runs on a schedule`]
      : isOneCron(on['schedule'])
        ? []
        : [`${WORKFLOW}: on.schedule must be exactly one cron entry`]),
  ];
};

const coverageFindings = (jobs: Json): readonly string[] => {
  const runs = Object.entries(jobs).flatMap(([id, definition]) => {
    const job = isRecord(definition) ? definition : {};
    const scheduled = typeof job['if'] === 'string' && SCHEDULE_ONLY.test(job['if']);
    const steps = (Array.isArray(job['steps']) ? job['steps'] : []).filter(isRecord);

    return steps.flatMap((step) => {
      const group = entryGroup(step);

      return group === undefined ? [] : [{ id, group, scheduled }];
    });
  });

  return GROUPS.flatMap((group) => {
    const optIn = OPT_IN.includes(group);
    const named = runs.filter((run) => run.group === group);
    const proper = named.filter((run) => run.scheduled === optIn);
    const misplaced = named.filter((run) => run.scheduled !== optIn);

    return [
      ...(proper.length === 1
        ? []
        : [`${WORKFLOW}: group ${group} is named by ${proper.length} ${optIn ? 'schedule-only' : 'pull-request'} job entries instead of one`]),
      ...misplaced.map((run) => `${WORKFLOW}: job ${run.id} runs group ${group}, which belongs ${optIn ? 'to the schedule-only job' : 'to a pull-request job'}`),
    ];
  });
};

export const workflowFindings = (text: string): readonly string[] => {
  const parsed: unknown = (createRequire(import.meta.url)('yaml') as typeof Yaml).parse(text);
  const workflow = isRecord(parsed) ? parsed : {};
  const jobs = isRecord(workflow['jobs']) ? workflow['jobs'] : {};

  return [
    ...extraKeys(workflow, WORKFLOW_KEYS).map((key) => `${WORKFLOW} carries ${key} at the top; only ${WORKFLOW_KEYS.join(', ')} are allowed`),
    ...triggerFindings(workflow['on']),
    ...(isDeepStrictEqual(workflow['concurrency'], CONCURRENCY)
      ? []
      : [`${WORKFLOW}: concurrency must be exactly ${JSON.stringify(CONCURRENCY)}, so that only a superseded pull-request run is cancelled`]),
    ...Object.entries(jobs).flatMap(([id, definition]) => jobFindings(id, isRecord(definition) ? definition : {})),
    ...coverageFindings(jobs),
  ];
};

const nvmrcFindings = (root: string): readonly string[] => {
  const path = join(root, NVMRC);

  return existsSync(path) && EXACT_NODE.test(readFileSync(path, 'utf8')) ? [] : [`${NVMRC} must hold one exact Node 24 version, x.y.z`];
};

export const workflowGuard = (root: string): readonly string[] => [
  ...workflowFindings(readFileSync(join(root, WORKFLOW), 'utf8')),
  ...nvmrcFindings(root),
];
