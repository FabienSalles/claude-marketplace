import { rmSync } from 'node:fs';

import type { FileSystem } from '../ports.ts';

export const fs: FileSystem = {
  removeTree: (path) => rmSync(path, { recursive: true, force: true }),
};
