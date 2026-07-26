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
    { title: 'Report', detail: 'scan, push the branch, write the outcome to the issue' },
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

// The run is write-only towards GitHub: it posts, and it never reads a title, a body or a
// comment. An agent that reads attacker-controlled text and also holds write credentials is one
// injection away from using them, so the text posted here is always built from the plan.
const post = async (target, subject, text) => {
  const result = await agent(
    [
      `Post the text below as a comment on ${target}, exactly as given, changing nothing.`,
      '',
      'Write it to a temporary file first, then post that file. Report the exit code of the',
      'posting command and nothing else. Do not read the issue or the pull request, do not',
      'summarise, do not add a greeting, and do not decide the text needs improving.',
      '',
      `--- ${subject} ---`,
      text,
      '--- end ---',
    ].join('\n'),
    { agentType: 'goal-reporter', schema: RUN_RESULT, effort: 'low', label: `report:${target}`, phase: 'Report' },
  );

  return result ?? { exitCode: -1, output: `The reporter returned nothing for ${target}.` };
};

// The issue number comes from the plan's own header, never from GitHub. A plan with no issue
// reports locally and says so: the GitHub mirror is opt-in, by design, from /goal:draft-issue on.
const ISSUE_FROM_PLAN = String.raw`sed -n 's/^Source: gh issue #\([0-9][0-9]*\).*/\1/p'`;

// Scan, then push: a halted branch is pushed on purpose — unattended, the alternative is that
// the only machine that knows what happened is the one that is now asleep — and nothing is
// pushed that a scanner has not passed.
const pushBranch = async () => {
  const scan = await runner(`${GATE} scan`, 'scan', 'Report');

  if (scan.exitCode !== 0) {
    return { pushed: false, scanned: false, detail: scan.output };
  }

  const push = await runner('git push -u origin HEAD', 'push', 'Report');

  return { pushed: push.exitCode === 0, scanned: true, detail: push.output };
};

const haltReport = (report) =>
  [
    `## Run halted at iteration ${report.iteration}`,
    '',
    `Plan: \`${report.plan}\``,
    `Landed, each gate-verified: ${report.landed.join(' ') || 'nothing'}`,
    `Never attempted: ${report.notAttempted.join(' ') || 'nothing'}`,
    '',
    report.push?.pushed === true
      ? 'The branch is pushed. The working tree of the halted iteration is left exactly as the implementer left it, on the machine that ran it.'
      : `The branch is **not** pushed:\n\n\`\`\`\n${(report.push?.detail ?? '').slice(-1500)}\n\`\`\``,
    '',
    'The gate said, verbatim:',
    '',
    '```',
    report.detail.slice(-4000),
    '```',
    '',
    'Nothing was retried and no iteration after this one was attempted.',
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

const found = await runner(`${ISSUE_FROM_PLAN} ${PLAN} | head -1`, 'issue', 'Survey');
const issue = /^[0-9]+$/.test(found.output.trim()) ? found.output.trim() : undefined;

if (issue === undefined) {
  log('The plan names no GitHub issue, so the run reports to its return value alone.');
} else {
  await post(
    `issue #${issue}`,
    'run started',
    [
      `## Run started on \`${PLAN}\``,
      '',
      `Iterations to run, in order: ${pending.join(' ')}`,
      `Plan hash locked for the run: \`${hash}\``,
      '',
      'Each one is implemented by an agent that cannot commit, then judged by the gate, which',
      'commits and ticks only after every check passed. The first refusal ends the run.',
    ].join('\n'),
  );
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

    const report = {
      status: stopped.status,
      plan: PLAN,
      iteration: stopped.iteration,
      detail: stopped.detail,
      landed,
      notAttempted: pending.slice(stopped.from),
    };

    if (report.status !== 'halted') {
      return report;
    }

    phase('Report');

    report.push = await pushBranch();

    if (issue !== undefined) {
      report.reported = (await post(`issue #${issue}`, 'run halted', haltReport(report))).exitCode === 0;
    }

    return report;
  }

  landed.push(iteration);
  log(`iteration ${iteration} landed, gate-verified`);
}

await release();

return { status: 'done', plan: PLAN, landed, notAttempted: [] };
