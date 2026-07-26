// The orchestration layer of an autonomous run: order, halt, pause. It never implements,
// never commits and never ticks — every write to the tree is an implementer's, every verdict
// and every commit is the gate's. A workflow script has no disk and no shell, which is what
// makes that separation structural rather than a promise.
//
// Invoked by scriptPath, with args:
//   plan  (required) the locked plan, repo-relative
//   gate  (optional) how to invoke the gate; defaults to this repository's own path

export const meta = {
  name: 'goal-auto',
  description: 'Run a locked goal plan iteration by iteration, each judged by the gate, halting at the first refusal',
  whenToUse:
    'Launched by /goal:auto once a plan is locked. Not for exploratory work: every iteration must already carry a gate block.',
  phases: [
    { title: 'Survey', detail: 'take the run lock, list the unchecked iterations, refuse an unrunnable one' },
    { title: 'Iterate', detail: 'one implementer, then the gate, per iteration' },
  ],
};

const GATE = typeof args?.gate === 'string' && args.gate !== '' ? args.gate : 'node plugins/goal/scripts/goal-gate.ts';

const PLAN = args?.plan;

// An iteration that runs out of budget halfway leaves work no gate has judged. The loop stops
// at a boundary instead, where the plan's own checkboxes are the whole state.
const ITERATION_FLOOR = 80_000;

const RUN_RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['exitCode', 'output'],
  properties: {
    exitCode: { type: 'integer' },
    output: { type: 'string' },
  },
};

// Every command crosses back as {exitCode, output} rather than as transcript, so the
// orchestrator's context does not grow with the number of iterations.
const runner = async (command, label, phase) => {
  const result = await agent(
    [
      'Run exactly this command, once, from the repository root:',
      '',
      command,
      '',
      'Return its exit code and its combined stdout and stderr verbatim.',
      'Do not fix anything, do not retry, do not run any other command, and do not interpret what you read.',
    ].join('\n'),
    { agentType: 'goal-runner', schema: RUN_RESULT, effort: 'low', label, phase },
  );

  return result ?? { exitCode: -1, output: `The runner returned nothing for: ${command}` };
};

const brief = (iteration) =>
  [
    `Implement iteration ${iteration} of the locked plan ${PLAN}.`,
    '',
    `Read the whole of its "### Iteration ${iteration}" section: the goal, the files to touch, the`,
    'business rules it covers, every decision bullet, and its gate block. Those bullets were written',
    'at a checkpoint by someone who was there — they are binding, do not re-decide them.',
    '',
    'The gate block is your scope. Write only the paths listed in its test_files and impl_files:',
    'any other changed path halts this iteration, whatever the porcelain code says.',
    '',
    'Work test-first, and show the RED: the gate sets your implementation aside and requires gate1',
    'to fail without it, so a test that passes either way halts the slice.',
    '',
    'Load the project convention skills before writing anything, and follow the delivery mode the',
    'plan header declares.',
    '',
    'You do not commit, do not push, do not stage, do not tick a checkbox and do not edit the plan.',
    'The gate does all of that, after it has verified. Your report is advisory: the gate is replayed',
    'independently and its exit code is the only verdict.',
  ].join('\n');

const iterationsPending = (output) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[0-9]+$/.test(line));

// The same rule the gate reads the plan by: an iteration heading, then the first checkbox in its
// section. Kept to one awk expression so it stays mechanical rather than a reading of the plan.
const SURVEY = String.raw`awk '/^### Iteration [0-9]+/ { n = $3; seen = 0 } /^- \[/ { if (n != "" && seen == 0) { seen = 1; if ($0 ~ /^- \[ \]/) print n } }'`;

const release = async () => runner(`${GATE} unlock ${PLAN}`, 'unlock', 'Iterate');

if (typeof PLAN !== 'string' || PLAN === '') {
  throw new Error('goal-auto needs args.plan: the repo-relative path of a locked plan.');
}

phase('Survey');

const lock = await runner(`${GATE} lock ${PLAN}`, 'lock', 'Survey');

// The lock is not held, so this exit path is the one that must not release it.
if (lock.exitCode !== 0) {
  return { status: 'refused', plan: PLAN, landed: [], notAttempted: [], detail: lock.output };
}

const survey = await runner(`${SURVEY} ${PLAN}`, 'survey', 'Survey');

if (survey.exitCode !== 0) {
  await release();

  return { status: 'refused', plan: PLAN, landed: [], notAttempted: [], detail: survey.output };
}

const pending = iterationsPending(survey.output);

log(`${pending.length} unchecked iteration(s): ${pending.join(' ') || 'none'}`);

if (pending.length === 0) {
  await release();

  return { status: 'done', plan: PLAN, landed: [], notAttempted: [] };
}

// Refusing every unrunnable iteration before implementing anything is the whole point of the
// survey: a missing gate block is worth knowing at the start of the night, not at iteration 9.
const runnable = await runner(
  `for n in ${pending.join(' ')}; do ${GATE} check ${PLAN} $n || exit 1; done`,
  'check-all',
  'Survey',
);

if (runnable.exitCode !== 0) {
  await release();

  return { status: 'refused', plan: PLAN, landed: [], notAttempted: pending, detail: runnable.output };
}

// The hash the whole run is judged against: published by check, passed back to every gate call,
// and never recomputed. Recomputing it per iteration would bless a plan rewritten at iteration 1.
const hash = (/^plan_hash=([0-9a-f]{64})$/m.exec(runnable.output) ?? [])[1];

if (hash === undefined) {
  await release();

  return {
    status: 'refused',
    plan: PLAN,
    landed: [],
    notAttempted: pending,
    detail: `The survey published no plan_hash, so nothing locks the contract:\n${runnable.output}`,
  };
}

phase('Iterate');

const landed = [];
let stopped;

for (const [index, iteration] of pending.entries()) {
  if (budget.total && budget.remaining() < ITERATION_FLOOR) {
    stopped = {
      status: 'paused',
      iteration,
      from: index,
      detail: `Stopped before iteration ${iteration}: ${Math.round(budget.remaining() / 1000)}k tokens left, under the ${ITERATION_FLOOR / 1000}k floor one iteration needs. Nothing is wrong; relaunch and the plan's checkboxes resume the run here.`,
    };
  }

  if (stopped === undefined) {
    const implemented = await agent(brief(iteration), {
      agentType: 'goal-implementer',
      label: `implement:${iteration}`,
      phase: 'Iterate',
    });

    if (implemented === null) {
      stopped = {
        status: 'paused',
        iteration,
        from: index + 1,
        detail: `The implementer of iteration ${iteration} returned nothing — skipped, or dead after retries. The tree holds whatever it wrote and no gate has judged it: review it before relaunching.`,
      };
    }
  }

  if (stopped === undefined) {
    const gate = await runner(`${GATE} commit ${PLAN} ${iteration} ${hash}`, `gate:${iteration}`, 'Iterate');

    if (gate.exitCode !== 0) {
      stopped = { status: 'halted', iteration, from: index + 1, detail: gate.output };
    }
  }

  // A halt is final: the iterations after it are never attempted, and the tree is left exactly
  // as the implementer left it.
  if (stopped !== undefined) {
    await release();

    return {
      status: stopped.status,
      plan: PLAN,
      iteration: stopped.iteration,
      detail: stopped.detail,
      landed,
      notAttempted: pending.slice(stopped.from),
    };
  }

  landed.push(iteration);
  log(`iteration ${iteration} landed, gate-verified`);
}

await release();

return { status: 'done', plan: PLAN, landed, notAttempted: [] };
