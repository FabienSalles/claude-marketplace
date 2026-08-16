// The contracts every adapter honours, so a caller depends on the shape of the outside world —
// a command that runs, a tree that gets removed, a clock that ticks — and never on
// node:child_process, node:fs, or Date directly.

export interface CommandOptions {
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  killSignal?: NodeJS.Signals;
  maxBuffer?: number;
  encoding?: 'utf8';
}

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface BinaryResult {
  status: number | null;
  stdout: Buffer;
  stderr: Buffer;
}

export interface CommandRunner {
  run(command: string, args: string[], options?: CommandOptions): CommandResult;
  runBinary(command: string, args: string[], options?: CommandOptions): BinaryResult;
}

export interface DirEntry {
  name: string;
  isDirectory(): boolean;
}

export interface FileSystem {
  removeTree(path: string): void;
  removeFile(path: string): void;
  exists(path: string): boolean;
  readFile(path: string): string;
  readFileBuffer(path: string): Buffer;
  readDir(path: string): string[];
  readDirEntries(path: string): DirEntry[];
  writeFile(path: string, content: string | Buffer): void;
  appendFile(path: string, content: string): void;
  mkdir(path: string, options?: { recursive?: boolean }): void;
  copyFile(src: string, dest: string): void;
  mkdtemp(prefix: string): string;
  mtime(path: string): number;
  isFile(path: string): boolean;
  homeDir(): string;
  tmpDir(): string;
}

export interface Clock {
  now(): number;
  sleepSeconds(seconds: number): void;
}
