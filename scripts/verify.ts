import { resolve } from 'node:path';

import { guarded } from './verify/guard.ts';

process.exitCode = await guarded(resolve(import.meta.dirname, '..'), resolve(import.meta.dirname, 'verify', 'main.ts'), process.argv.slice(2));
