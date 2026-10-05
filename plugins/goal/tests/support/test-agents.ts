import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentReport, AgentRole, AgentSessions, FailureClass } from '../../src/ports.ts';

export type Launched = { role: AgentRole; brief: string };

export type TestAgents = {
  adapter: AgentSessions;
  launched: Launched[];
  postmortems: number[];
};

const reportOf = (failureClass: FailureClass, outPath: string, errPath: string): AgentReport => ({
  end: { status: failureClass === 'success' ? 0 : 1, signal: null },
  outcome: { text: `${failureClass} answer`, isError: failureClass !== 'success', class: failureClass, quote: 'second adapter' },
  consumption: { usage: { input_tokens: 3, output_tokens: 4 }, compactions: 0 },
  sessionId: 'second-session',
  durationMs: 1,
  outPath,
  errPath,
  ignoredLines: 0,
});

export const testAgents = (implementerClasses: FailureClass[]): TestAgents => {
  const launched: Launched[] = [];
  const postmortems: number[] = [];
  let implementerLaunches = 0;

  const adapter: AgentSessions = {
    launch: async (role, brief, options) => {
      launched.push({ role, brief });
      writeFileSync(options.outPath, '');
      writeFileSync(options.errPath, '');
      options.onSession('second-session');

      if (role !== 'implementer') {
        return reportOf('success', options.outPath, options.errPath);
      }

      options.onTool('RUN tool second-adapter wrote a.txt');
      appendFileSync(join(process.cwd(), 'a.txt'), 'written\n');
      const failureClass = implementerClasses[Math.min(implementerLaunches, implementerClasses.length - 1)]!;
      implementerLaunches += 1;

      return reportOf(failureClass, options.outPath, options.errPath);
    },
    postmortem: (report, say, context) => {
      postmortems.push(context.attempt);
      say(`RUN second adapter diagnosis of attempt ${context.attempt}: ${report.outcome.class}`);
    },
  };

  return { adapter, launched, postmortems };
};
