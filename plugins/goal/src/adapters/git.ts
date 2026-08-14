import { command } from './command.ts';

export const git = (...args: string[]) => command.run('git', args);
