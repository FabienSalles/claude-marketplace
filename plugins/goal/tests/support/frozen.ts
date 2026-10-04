import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Declared = {
  readonly file: string;
  readonly name: string;
  readonly skipped: boolean;
};

const DECLARATION = /^[ \t]*test(?:\.(\w+))?\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/gm;
const OPTIONS_WINDOW = 200;

export const declaredTests = (dir: string): readonly Declared[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .flatMap((file) => {
      const source = readFileSync(join(dir, file), 'utf8');

      return [...source.matchAll(DECLARATION)].map((match) => {
        const after = source.slice(
          (match.index ?? 0) + match[0].length,
          (match.index ?? 0) + match[0].length + OPTIONS_WINDOW,
        );
        const options = after.split(/=>|function/)[0] ?? '';
        const skipped =
          match[1] === 'skip' || match[1] === 'todo' || /\b(skip|todo)\b/.test(options);

        return { file, name: match[3] ?? '', skipped };
      });
    });

export type Frozen = { readonly file: string; readonly name: string };

export const parseFrozen = (text: string): readonly Frozen[] =>
  text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [file = '', ...name] = line.split('\t');

      return { file, name: name.join('\t') };
    });

export const serializeFrozen = (entries: readonly Frozen[]): string =>
  entries.map(({ file, name }) => `${file}\t${name}\n`).join('');

export const frozenProblems = (
  frozen: readonly Frozen[],
  declared: readonly Declared[],
): readonly string[] =>
  frozen.flatMap(({ file, name }) => {
    const found = declared.filter((entry) => entry.name === name);

    if (found.length === 0) {
      return [`missing: "${name}" (frozen in ${file}) is declared nowhere`];
    }

    if (found.length > 1) {
      const where = found.map((entry) => entry.file).join(', ');

      return [`duplicated: "${name}" (frozen in ${file}) is declared ${found.length} times: ${where}`];
    }

    return found[0]?.skipped === true
      ? [`skipped: "${name}" (frozen in ${file}) is skipped or todo'd in ${found[0].file}`]
      : [];
  });

export const checkFrozen = (testsDir: string): readonly string[] =>
  frozenProblems(
    parseFrozen(readFileSync(join(testsDir, 'frozen-names.txt'), 'utf8')),
    declaredTests(testsDir),
  );

if (import.meta.main) {
  const problems = checkFrozen(join(import.meta.dirname, '..'));

  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.stderr.write(`HALT: ${problems.length} frozen test name(s) lost, renamed, skipped or duplicated.\n`);
    process.exit(1);
  }

  process.stdout.write('OK: every frozen test name is declared exactly once, and none is skipped.\n');
}
