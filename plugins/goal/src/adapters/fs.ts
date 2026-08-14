import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';

import type { FileSystem } from '../ports.ts';

export const fs: FileSystem = {
  removeTree: (path) => rmSync(path, { recursive: true, force: true }),
  removeFile: (path) => rmSync(path, { force: true }),
  exists: (path) => existsSync(path),
  readFile: (path) => readFileSync(path, 'utf8'),
  readFileBuffer: (path) => readFileSync(path),
  readDir: (path) => readdirSync(path),
  readDirEntries: (path) => readdirSync(path, { withFileTypes: true }),
  writeFile: (path, content) => writeFileSync(path, content),
  appendFile: (path, content) => appendFileSync(path, content),
  mkdir: (path, options) => mkdirSync(path, options),
  copyFile: (src, dest) => copyFileSync(src, dest),
  mkdtemp: (prefix) => mkdtempSync(prefix),
  mtime: (path) => statSync(path).mtimeMs,
  isFile: (path) => statSync(path).isFile(),
  homeDir: () => homedir(),
  tmpDir: () => tmpdir(),
};
