import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { clock } from '../adapters/clock.ts';
import { command as runner } from '../adapters/command.ts';
import { fs } from '../adapters/fs.ts';
import { settingValue } from '../core/settings.ts';
import { spawnOptions } from './bounded.ts';
import { stopGroup } from './group-run.ts';
import { halt, restorers } from './halt.ts';

const LOG_TAIL = 4000;
const READY_POLL_SECONDS = 0.2;

type Service = {
  key: string;
  command: string;
  ready: string;
  paths: string[];
  log: string;
  pid: number | undefined;
  signature: string;
  fresh: boolean;
};

export type Services = {
  start: () => void;
  before: (next: string) => void;
  stop: () => void;
};

const logDirectory = (): string => {
  const jsonl = process.env.GOAL_RUN_JSONL;

  return jsonl === undefined || jsonl === '' ? fs.tmpDir() : dirname(jsonl);
};

const signatureOf = (paths: string[]): string => {
  if (paths.length === 0) {
    return '';
  }

  const listed = runner.run('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', ...paths]).stdout;
  const digest = createHash('sha256');

  for (const path of listed.split('\0').filter((entry) => entry !== '')) {
    digest.update(path).update(fs.exists(path) ? fs.readFileBuffer(path) : Buffer.of(0));
  }

  return digest.digest('hex');
};

const alive = (service: Service): boolean => {
  const ps = runner.run('ps', ['-o', 'stat=', '-p', String(service.pid)]);

  return ps.status === 0 && !ps.stdout.trim().startsWith('Z');
};

const refuse = (service: Service, what: string): never => {
  const log = fs.exists(service.log) ? fs.readFile(service.log) : '';

  return halt(
    `Service ${service.key} ${what}.`,
    `Command: ${service.command}\nReadiness: ${service.ready}\n\nLast ${LOG_TAIL} characters of its output (${service.log}):\n${log.slice(-LOG_TAIL)}`,
  );
};

const waitReady = (service: Service, when: string): void => {
  const deadline = clock.now() + settingValue('GOAL_CMD_TIMEOUT', process.env) * 1000;

  while (clock.now() < deadline) {
    if (!alive(service)) {
      refuse(service, `exited, so it was never ready ${when}`);
    }

    if (runner.run(service.ready, [], { ...spawnOptions(), timeout: Math.max(1, deadline - clock.now()) }).status === 0) {
      return;
    }

    clock.sleepSeconds(READY_POLL_SECONDS);
  }

  refuse(service, `was never ready ${when}`);
};

const launch = (service: Service, when: string): void => {
  const out = openSync(service.log, 'w');
  const child = spawn('/bin/sh', ['-c', service.command], { detached: true, stdio: ['ignore', out, out], env: spawnOptions().env });

  closeSync(out);
  child.unref();
  service.pid = child.pid;
  service.signature = signatureOf(service.paths);
  service.fresh = true;
  waitReady(service, when);
};

const stopService = (service: Service): void => {
  if (service.pid !== undefined) {
    stopGroup(service.pid);
    service.pid = undefined;
  }
};

export const declaredServices = (declared: Map<string, string>): Services => {
  const directory = logDirectory();
  const services: Service[] = [...declared.keys()]
    .filter((key) => /^service[1-9][0-9]*$/.test(key))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((key) => ({
      key,
      command: declared.get(key) ?? '',
      ready: declared.get(`${key}_ready`) ?? '',
      paths: (declared.get(`${key}_paths`) ?? '').split(/\s+/).filter((path) => path !== ''),
      log: join(directory, `goal-${process.pid}-${key}.log`),
      pid: undefined,
      signature: '',
      fresh: false,
    }));
  let last = 'the start';

  const stop = (): void => {
    [...services].reverse().forEach((service) => {
      stopService(service);
      fs.removeFile(service.log);
    });
  };

  return {
    start: () => {
      restorers.push(stop);
      services.forEach((service) => launch(service, 'before the first gate'));
    },
    before: (next) => {
      for (const service of services) {
        if (!alive(service)) {
          refuse(service, `died after ${last}`);
        }

        const changed = service.paths.length === 0 ? !service.fresh : signatureOf(service.paths) !== service.signature;

        if (changed) {
          stopService(service);
          launch(service, `before ${next}`);
        }

        service.fresh = false;
      }

      last = next;
    },
    stop,
  };
};
