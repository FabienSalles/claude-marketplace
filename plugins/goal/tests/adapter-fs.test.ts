import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { fs } from '../src/adapters/fs.ts';
import { tmpDir } from './support/tmp.ts';

// R5 — the real FileSystem adapter is the one seam production reaches the disk through: this is
// the single test file that ever lets it touch a real directory, everywhere else substitutes it.
test('fs.writeFile then fs.readFile round-trips the content it was given', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const path = join(dir, 'file.txt');

  fs.writeFile(path, 'hello');

  assert.equal(fs.readFile(path), 'hello');
});

test('fs.readFileBuffer hands back raw bytes rather than a decoded string', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const path = join(dir, 'file.bin');

  fs.writeFile(path, Buffer.from([0, 1, 2]));

  const buffer = fs.readFileBuffer(path);

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual([...buffer], [0, 1, 2]);
});

test('fs.exists reports true for a path it just wrote and false once removed', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const path = join(dir, 'file.txt');

  fs.writeFile(path, 'hello');
  assert.equal(fs.exists(path), true);

  fs.removeFile(path);
  assert.equal(fs.exists(path), false);
});

test('fs.appendFile adds to what is already on disk rather than overwriting it', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const path = join(dir, 'file.txt');

  fs.writeFile(path, 'a');
  fs.appendFile(path, 'b');

  assert.equal(fs.readFile(path), 'ab');
});

test('fs.mkdir with recursive creates every missing parent directory', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const nested = join(dir, 'a', 'b', 'c');

  fs.mkdir(nested, { recursive: true });

  assert.equal(fs.exists(nested), true);
});

test('fs.mkdir with no recursive throws when the directory already exists', () => {
  const dir = tmpDir('goal-adapter-fs-');

  assert.throws(() => fs.mkdir(dir));
});

test('fs.readDir lists the entries a directory holds', () => {
  const dir = tmpDir('goal-adapter-fs-');
  fs.writeFile(join(dir, 'one.txt'), '1');
  fs.writeFile(join(dir, 'two.txt'), '2');

  assert.deepEqual(fs.readDir(dir).sort(), ['one.txt', 'two.txt']);
});

test('fs.readDirEntries tells a directory apart from a file', () => {
  const dir = tmpDir('goal-adapter-fs-');
  fs.mkdir(join(dir, 'sub'));
  fs.writeFile(join(dir, 'file.txt'), '1');

  const entries = fs.readDirEntries(dir);
  const sub = entries.find((entry) => entry.name === 'sub');
  const file = entries.find((entry) => entry.name === 'file.txt');

  assert.equal(sub?.isDirectory(), true);
  assert.equal(file?.isDirectory(), false);
});

test('fs.copyFile leaves the source untouched and the destination carrying its content', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const src = join(dir, 'src.txt');
  const dest = join(dir, 'dest.txt');
  fs.writeFile(src, 'hello');

  fs.copyFile(src, dest);

  assert.equal(fs.readFile(dest), 'hello');
  assert.equal(fs.readFile(src), 'hello');
});

test('fs.mkdtemp creates a fresh directory under the prefix it is given', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const created = fs.mkdtemp(join(dir, 'work-'));

  assert.equal(fs.exists(created), true);
  assert.ok(created.startsWith(join(dir, 'work-')));
});

test('fs.mtime and fs.isFile report the stat of a real file', () => {
  const dir = tmpDir('goal-adapter-fs-');
  const path = join(dir, 'file.txt');
  fs.writeFile(path, 'hello');

  assert.equal(fs.isFile(path), true);
  assert.ok(fs.mtime(path) > 0);
  assert.equal(fs.isFile(dir), false);
});

test('fs.removeTree removes a directory and everything under it', () => {
  const dir = tmpDir('goal-adapter-fs-');
  fs.writeFile(join(dir, 'file.txt'), 'hello');

  fs.removeTree(dir);

  assert.equal(fs.exists(dir), false);
});

test('fs.homeDir and fs.tmpDir report real, non-empty paths', () => {
  assert.ok(fs.homeDir().length > 0);
  assert.ok(fs.tmpDir().length > 0);
});
