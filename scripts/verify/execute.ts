import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

import type { Check, Outcome } from './ports.ts';

export const execute = (check: Check, root: string): Outcome => {
  if ('inline' in check) {
    const findings = check.inline(root);

    return { status: findings.length === 0 ? 'passed' : 'failed', detail: findings.join('\n') };
  }

  const [program = '', ...args] = check.command;
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', shell: false });
  const output = `${result.stdout}${result.stderr}${result.error === undefined ? '' : `${result.error.message}\n`}`;
  const produced = check.expectOutput === undefined || check.expectOutput.test(stripVTControlCharacters(output));

  if (result.status === 0 && produced) {
    return { status: 'passed', detail: '' };
  }

  return { status: 'failed', detail: result.status === 0 ? `${output}\nexpected output not produced` : output };
};
