// Shared shell helpers: every runner module that shells out needs the same quoting and the same
// git(), so one definition of each lives here rather than four and five copies drifting apart.

export const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

export { git } from '../adapters/git.ts';
