import { resolve } from 'node:path';

import { guarded } from '../../verify/guard.ts';

process.exitCode = await guarded(process.cwd(), resolve(import.meta.dirname, 'verify-inner.ts'), process.argv.slice(2), process.env['FIXTURE_MARKER']);
