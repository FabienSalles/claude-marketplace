import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type * as Yaml from 'yaml';

import { GROUPS } from './checks.ts';

type Step = { readonly name?: unknown; readonly uses?: unknown; readonly run?: unknown; readonly with?: unknown };

type Job = { readonly if?: unknown; readonly steps?: unknown };

const WORKFLOW = join('.github', 'workflows', 'validate.yml');

const CLAUDE_INSTALL = 'npm install -g @anthropic-ai/claude-code';

const ENTRY = /^npm run verify -- ([a-z-]+)$/;

const SCHEDULE_ONLY = /^\s*github\.event_name\s*==\s*'schedule'\s*$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const describe = (step: Step): string => {
  for (const label of [step.name, step.run, step.uses]) {
    if (typeof label === 'string') {
      return label.trim();
    }
  }

  return 'unnamed step';
};

const refusal = (step: Step): string | undefined => {
  const inputs = isRecord(step.with) ? step.with : {};

  if (typeof step.uses === 'string') {
    const action = step.uses.split('@')[0];

    if (action === 'actions/checkout') {
      return Object.entries(inputs).every(([key, value]) => key === 'fetch-depth' && String(value) === '0')
        ? undefined
        : 'checkout takes only fetch-depth: 0';
    }

    if (action === 'actions/setup-node') {
      return Object.keys(inputs).length === 1 && String(inputs['node-version']) === '24' ? undefined : 'setup-node must be on Node 24';
    }

    return 'not an allowed setup action';
  }

  if (typeof step.run !== 'string') {
    return 'neither an action nor a command';
  }

  const command = step.run.trim();
  const group = ENTRY.exec(command)?.[1];

  if (command === CLAUDE_INSTALL || (group !== undefined && GROUPS.includes(group))) {
    return undefined;
  }

  return group === undefined ? 'not a setup step nor the entry' : `unknown group ${group}`;
};

const isEntry = (step: Step): boolean => typeof step.run === 'string' && ENTRY.test(step.run.trim());

export const workflowFindings = (text: string): readonly string[] => {
  const parsed: unknown = (createRequire(import.meta.url)('yaml') as typeof Yaml).parse(text);
  const jobs = isRecord(parsed) && isRecord(parsed['jobs']) ? parsed['jobs'] : {};

  return Object.entries(jobs).flatMap(([id, definition]) => {
    const job = (isRecord(definition) ? definition : {}) as Job;

    if (typeof job.if === 'string' && SCHEDULE_ONLY.test(job.if)) {
      return [];
    }

    const steps = (Array.isArray(job.steps) ? job.steps : []).filter(isRecord) as readonly Step[];
    const findings = steps.flatMap((step) => {
      const reason = refusal(step);

      return reason === undefined ? [] : [`${WORKFLOW}: job ${id}, step "${describe(step)}": ${reason}`];
    });

    return steps.some(isEntry) ? findings : [...findings, `${WORKFLOW}: job ${id} never runs the entry`];
  });
};

export const workflowGuard = (root: string): readonly string[] => workflowFindings(readFileSync(join(root, WORKFLOW), 'utf8'));
