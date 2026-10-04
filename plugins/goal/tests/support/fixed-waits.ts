import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const FIXED_WAIT = [/\bsleep \d/, /\bsetTimeout\(/, /\bAtomics\.wait\b/, /\bsleepSeconds\(\s*[\d.]/];

const EXEMPT = new Set([
  'adapter-clock.test.ts',
  'bounded.test.ts',
  'suite-guards.test.ts',
  'support/await-state.ts',
]);

const sources = (root: string, dir: string = root): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return sources(root, path);
      }

      return entry.name.endsWith('.ts') ? [relative(root, path)] : [];
    })
    .sort();

export const fixedWaits = (root: string): readonly string[] =>
  sources(root)
    .filter((file) => !EXEMPT.has(file))
    .flatMap((file) =>
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .flatMap((line, index) => (FIXED_WAIT.some((pattern) => pattern.test(line)) ? [`${file}:${index + 1}`] : [])),
    );
