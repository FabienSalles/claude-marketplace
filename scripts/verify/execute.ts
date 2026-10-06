import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

import type { Check, CommandCheck, Outcome } from './ports.ts';

const DEFAULT_TIMEOUT_SECONDS = 120;

const GRACE_MS = 5_000;

const signalGroup = (pid: number | undefined, signal: NodeJS.Signals): void => {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch {
    // the group already exited
  }
};

const failed = (output: string, reason: string): Outcome => ({
  status: 'failed',
  detail: output.trim() === '' ? reason : `${output.trimEnd()}\n${reason}`,
});

const judge = (check: CommandCheck, status: number | null, signal: NodeJS.Signals | null, output: string): Outcome => {
  const text = stripVTControlCharacters(output);
  const refused = check.refuseOutput === undefined ? null : check.refuseOutput.exec(text);

  if (status !== 0) {
    return failed(output, signal === null ? `exit status ${String(status)}` : `killed by ${signal}`);
  }

  if (refused !== null) {
    return failed(output, `refused output: ${refused[0].trim()}`);
  }

  return check.expectOutput === undefined || check.expectOutput.test(text)
    ? { status: 'passed', detail: '' }
    : failed(output, 'expected output not produced');
};

const runCommand = (check: CommandCheck, root: string, abort: AbortSignal): Promise<Outcome> =>
  new Promise((settle) => {
    const [program = '', ...args] = check.command;
    const seconds = check.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    const chunks: string[] = [];
    const timers: NodeJS.Timeout[] = [];
    let timedOut = false;
    let settled = false;
    const child = spawn(program, args, { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = (): void => {
      signalGroup(child.pid, typeof abort.reason === 'string' ? (abort.reason as NodeJS.Signals) : 'SIGTERM');
      timers.push(setTimeout(() => signalGroup(child.pid, 'SIGKILL'), GRACE_MS));
    };
    const finish = (outcome: Outcome): void => {
      if (settled) {
        return;
      }

      settled = true;
      signalGroup(child.pid, 'SIGKILL');

      for (const timer of timers) {
        clearTimeout(timer);
      }

      abort.removeEventListener('abort', forward);
      settle(outcome);
    };

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => chunks.push(chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => chunks.push(chunk));
    child.on('error', (error) => chunks.push(`${error.message}\n`));
    child.on('close', (status, signal) =>
      finish(timedOut ? failed(chunks.join(''), `timed out after ${seconds} s`) : judge(check, status, signal, chunks.join(''))),
    );
    abort.addEventListener('abort', forward, { once: true });

    if (abort.aborted) {
      forward();
    }

    timers.push(
      setTimeout(() => {
        timedOut = true;
        signalGroup(child.pid, 'SIGTERM');
        timers.push(setTimeout(() => signalGroup(child.pid, 'SIGKILL'), GRACE_MS));
        timers.push(
          setTimeout(() => {
            child.stdout.destroy();
            child.stderr.destroy();
            finish(failed(chunks.join(''), `timed out after ${seconds} s, and its output never closed`));
          }, 2 * GRACE_MS),
        );
      }, seconds * 1000),
    );
  });

export const execute = async (check: Check, root: string, abort: AbortSignal): Promise<Outcome> => {
  if ('command' in check) {
    return runCommand(check, root, abort);
  }

  try {
    const findings = check.inline(root);

    return { status: findings.length === 0 ? 'passed' : 'failed', detail: findings.join('\n') };
  } catch (error) {
    return { status: 'failed', detail: `threw: ${error instanceof Error ? error.message : String(error)}` };
  }
};
