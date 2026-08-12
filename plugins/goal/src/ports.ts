// The contracts every adapter honours, so a caller depends on the shape of the outside world —
// a command that runs, a tree that gets removed, a clock that ticks — and never on
// node:child_process, node:fs, or Date directly.

import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process';

export interface CommandRunner {
  run(command: string, args: string[], options?: SpawnSyncOptions): SpawnSyncReturns<string>;
}

export interface FileSystem {
  removeTree(path: string): void;
}

export interface Clock {
  now(): number;
}
