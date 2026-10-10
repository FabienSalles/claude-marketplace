import { spawn, spawnSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EARLIER_THAN_CALLER_MS = 250;
const STOP_ATTEMPTS = 10;

type Member = { pid: number; line: string };

const members = (pgid: number): Member[] => {
  const ps = spawnSync('/bin/ps', ['-A', '-o', 'pid=,pgid=,stat=,command='], { encoding: 'utf8' });
  const found: Member[] = [];

  for (const line of ps.stdout.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);

    if (match !== null) {
      const [, pid, group, state, command] = match;

      if (Number(group) === pgid && state?.startsWith('Z') !== true) {
        found.push({ pid: Number(pid), line: `${pid} ${command}` });
      }
    }
  }

  return found;
};

export const stopGroup = (pgid: number): string[] => {
  const stopped = new Map<number, string>();

  for (let attempt = 0; attempt < STOP_ATTEMPTS; attempt++) {
    const alive = members(pgid);

    if (alive.length === 0) {
      break;
    }

    alive.forEach((member) => stopped.set(member.pid, member.line));

    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {
      break;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }

  return [...stopped.values()];
};

export const groupRun = (script: string, seconds: number): void => {
  const child = spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'inherit' });
  const pgid = child.pid as number;
  let stopped: string[] = [];
  let onClock = false;
  const clock = setTimeout(() => {
    onClock = true;
    stopped = stopGroup(pgid);
  }, seconds * 1000 - EARLIER_THAN_CALLER_MS);

  child.on('exit', (status, signal) => {
    clearTimeout(clock);
    stopped = [...new Set([...stopped, ...stopGroup(pgid)])];

    if (onClock || stopped.length > 0) {
      const cause = onClock ? `goal: command clock reached after ${seconds} s` : 'goal: command left processes behind';

      writeSync(2, `${cause}; stopped:\n${stopped.map((line) => `  ${line}\n`).join('')}`);
    }

    if (signal !== null) {
      process.kill(process.pid, signal);
    }

    process.exit(status ?? 1);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  groupRun(process.argv[3] ?? '', Number(process.argv[2]));
}
