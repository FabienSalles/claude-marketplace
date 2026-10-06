import { spawn, type SpawnOptions } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

export const AWAIT_DEADLINE_MS = 30_000;

const POLL_MS = 20;

export type Hold = {
  state: string;
  markers: string[];
  signal: NodeJS.Signals;
  release?: string[];
  deadlineMs?: number;
  beforeSignal?: () => void;
};

export type Held = Error & { pid: number };

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

export const signalWhenHeld = async (
  cmd: string,
  args: string[],
  options: SpawnOptions,
  hold: Hold,
): Promise<{ code: number | null; output: string }> => {
  const deadlineMs = hold.deadlineMs ?? AWAIT_DEADLINE_MS;
  const child = spawn(cmd, args, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const pid = child.pid ?? -1;
  let output = '';
  let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null;

  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));

  const exited = new Promise<void>((done) => {
    child.once('exit', (code, signal) => {
      exit = { code, signal };
      done();
    });
  });

  const killGroup = () => {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // the group is already gone
    }
  };

  const fail = async (message: string): Promise<never> => {
    killGroup();
    await exited;

    throw Object.assign(new Error(`${message}\n${output}`), { pid }) as Held;
  };

  const missing = () => hold.markers.filter((marker) => !existsSync(marker));
  const startedAt = Date.now();

  while (missing().length > 0) {
    if (exit !== null) {
      const { code, signal } = exit as { code: number | null; signal: string | null };

      return fail(`exited (code ${code}, signal ${signal}) before ${hold.state}`);
    }

    if (Date.now() - startedAt > deadlineMs) {
      return fail(`${hold.state} never reached within ${deadlineMs} ms, missing: ${missing().join(', ')}`);
    }

    await pause(POLL_MS);
  }

  hold.beforeSignal?.();

  if (missing().length > 0) {
    return fail(`left ${hold.state} before the signal`);
  }

  process.kill(pid, hold.signal);

  for (const marker of hold.release ?? []) {
    writeFileSync(marker, '');
  }

  const settled = new AbortController();

  await Promise.race([exited, delay(deadlineMs, undefined, { signal: settled.signal }).catch(() => undefined)]);
  settled.abort();

  if (exit === null) {
    return fail(`did not exit after ${hold.signal} within ${deadlineMs} ms`);
  }

  killGroup();

  return { code: (exit as { code: number | null }).code, output };
};
