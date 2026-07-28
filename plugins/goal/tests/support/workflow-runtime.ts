import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '..', '..', 'workflows', 'goal-auto.js');

export type AgentCall = { prompt: string; opts: Record<string, unknown> };

export type Budget = { total: number | null; spent: () => number; remaining: () => number };

export type Reply = (call: AgentCall) => unknown;

export type RunOutcome = {
  result: unknown;
  // Surfaced rather than thrown: what the run did on its way out is exactly what a test about
  // cleanup has to read, and a rejection would take the recording with it.
  error?: unknown;
  agents: AgentCall[];
  commands: string[];
  logs: string[];
  phases: string[];
};

// The runner puts its command on the third line of its prompt, and it is the only agent that
// carries one: everything else is given text to post or a question to answer.
export const commandOf = (call: AgentCall): string =>
  call.opts.agentType === 'goal:goal-runner' ? (call.prompt.split('\n')[2] ?? '') : '';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

// The script ends on a top-level `return`, which is illegal in a module and proves the real
// runtime already wraps its body in an async function. Wrapping it the same way is the whole
// trick: the file under test is the file that ships, not a copy of it.
const compile = () =>
  new AsyncFunction(
    'agent',
    'parallel',
    'pipeline',
    'log',
    'phase',
    'args',
    'budget',
    'workflow',
    readFileSync(SCRIPT, 'utf8').replace(/^export const meta/m, 'const meta'),
  );

// Provided so the wrap matches the runtime's signature, and refusing loudly rather than
// pretending: a reimplementation nobody exercises would diverge without anyone noticing.
const notModelled = (name: string) => () => {
  throw new Error(`the fake runtime does not model ${name}() yet`);
};

const IDLE: Budget = { total: null, spent: () => 0, remaining: () => Number.POSITIVE_INFINITY };

export const runWorkflow = async (args: unknown, reply: Reply, budget: Budget = IDLE): Promise<RunOutcome> => {
  const agents: AgentCall[] = [];
  const commands: string[] = [];
  const logs: string[] = [];
  const phases: string[] = [];

  const agent = async (prompt: string, opts: Record<string, unknown> = {}) => {
    const call: AgentCall = { prompt, opts };
    const command = commandOf(call);

    agents.push(call);

    if (command !== '') {
      commands.push(command);
    }

    return reply(call);
  };

  // A thunk that throws resolves to null instead of rejecting, as the runtime documents.
  const parallel = (thunks: Array<() => unknown>) =>
    Promise.all(thunks.map((thunk) => Promise.resolve().then(thunk).catch(() => null)));

  let result: unknown;
  let error: unknown;

  try {
    result = await compile()(
      agent,
      parallel,
      notModelled('pipeline'),
      (message: string) => logs.push(message),
      (title: string) => phases.push(title),
      args,
      budget,
      notModelled('workflow'),
    );
  } catch (thrown) {
    error = thrown;
  }

  return { result, error, agents, commands, logs, phases };
};
