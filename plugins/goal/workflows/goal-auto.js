// The orchestration layer of an autonomous run: order, halt, pause. It never implements,
// never commits and never ticks — every write to the tree is an implementer's, every verdict
// and every commit is the gate's. A workflow script has no disk and no shell, which is what
// makes that separation structural rather than a promise.
//
// Invoked by scriptPath, with args:
//   plan  (required) the locked plan, repo-relative
//   gate  (optional) how to invoke the gate; defaults to this repository's own path
//
// A plan declaring tracks re-enters this same script once per track, so there is one loop and
// one set of rules rather than two. Those child runs carry three more args, and nothing else
// should ever set them by hand:
//   track       the branch suffix, which is also what marks a run as a child
//   dir         the track's worktree, every command of that run is prefixed with it
//   iterations  the track's iteration numbers, in plan order

export const meta = {
  name: 'goal-auto',
  description: 'Run a locked goal plan iteration by iteration, each judged by the gate, halting at the first refusal',
  whenToUse:
    'Launched by /goal:auto once a plan is locked. Not for exploratory work: every iteration must already carry a gate block.',
  phases: [
    { title: 'Survey', detail: 'take the run lock, list the unchecked iterations, refuse an unrunnable one' },
    { title: 'Iterate', detail: 'one implementer, then the gate, per iteration' },
    { title: 'Tracks', detail: 'one worktree per independent track, run in parallel' },
    { title: 'Report', detail: 'scan, push the branch, write the outcome to the issue' },
    { title: 'Ship', detail: 'replay the global Definition of Done, then mark the pull request ready' },
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

const TRACK = args?.track;
const DIR = args?.dir;

// A track runs in its own worktree, so every command that judges or publishes code is prefixed
// with the directory it belongs to: that prefix is what makes "a track's gate runs against that
// track's own code" a fact rather than an intention — the gate reads the tree it stands in.
// `cd` sets OLDPWD, which is how the plan keeps resolving: it lives in the main tree's
// gitignored `.claude/`, so it is absent from every worktree.
const inDir = (command) => (DIR === undefined ? command : `cd ${DIR} && ${command}`);

const PLAN_PATH = DIR === undefined ? args?.plan : `"$OLDPWD/${args?.plan}"`;

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
  const scan = await runner(inDir(`${GATE} scan`), 'scan', 'Report');

  if (scan.exitCode !== 0) {
    return { pushed: false, scanned: false, detail: scan.output };
  }

  const push = await runner(inDir('git push -u origin HEAD'), 'push', 'Report');

  return { pushed: push.exitCode === 0, scanned: true, detail: push.output };
};

// Reshaping happens once, before anything is pushed, and never again: after the first push
// folding a commit would need a force. The gate is the only committer and it never amends, so
// this is an assertion rather than a rewrite — and an assertion that fails is a refusal to push,
// because rewriting history nobody has reviewed, unattended, is worse than stopping.
const reshape = async (count) => {
  const shape = await runner(
    inDir(String.raw`git log --format=%s -${count} | grep -cE '^(fixup|squash)!' || true`),
    'reshape',
    'Report',
  );

  return shape.output.trim() === '0';
};

const quoted = (text) => text.replace(/'/g, '').trim();

const planFacts = async (numbers) => {
  const facts = await runner(
    `{ sed -n 's/^# Spec: //p' ${PLAN} | head -1; sed -n 's/^Delivery mode: //p' ${PLAN} | head -1; grep -E '^### Iteration (${numbers.join('|')}) ' ${PLAN}; }`,

    'plan-facts',
    'Report',
  );

  const lines = facts.output.split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');

  return {
    title: quoted(lines[0] ?? `Exécution de ${PLAN}`),
    mode: lines[1] ?? '',
    headings: lines.slice(2).map((line) => line.replace(/^### /, '')),
  };
};

const prBody = (facts, issue) =>
  [
    `Delivery mode : ${facts.mode || 'non déclaré'}`,
    '',
    '## Livré',
    '',
    ...facts.headings.map((heading) => `- ${heading}`),
    '',
    'Chaque itération a été jugée par le gate avant son commit : périmètre déclaré, budget de',
    'diff, suppressions, commandes d\'acceptation, trois runs de déterminisme, et le bite check',
    "qui exige que le test échoue sans l'implémentation. Aucun commit n'existe qu'un gate n'a pas",
    'vérifié.',
    ...(issue === undefined ? [] : ['', `Refs #${issue}`]),
  ].join('\n');

// A body carries backticks and newlines, so it travels as a file. Push failure and pull-request
// failure are reported separately: "pushed, no PR" is a real state and reading it as one
// ambiguous failure is how a run ends up with an invisible branch.
const publish = async (verb, facts, body) => {
  const create = verb === 'create';
  const command = [
    'body="$(git rev-parse --git-dir)/goal-pr-body.md"',
    'cat > "$body" <<\'GOALPRBODY\'',
    body,
    'GOALPRBODY',
    create
      ? `gh pr create --draft --title '${facts.title}' --body-file "$body"`
      : 'gh pr edit --body-file "$body"',
    'rc=$?',
    'rm -f "$body"',
    'exit $rc',
  ].join('\n');

  return runner(inDir(command), `pr:${verb}`, 'Report');
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

// The run lock belongs to the run, not to a track: a child never takes it and never releases it.
const release = async () => (TRACK === undefined ? runner(`${GATE} unlock ${PLAN}`, 'unlock', 'Iterate') : undefined);

const WORK_ID = (PLAN ?? '').split('/').pop()?.replace(/-spec\.md$/, '') ?? 'run';

// Deriving this script's own path from the gate's is what lets a track re-enter the same loop
// instead of a second copy of it. Tracks therefore need an absolute `args.gate`, which is what
// /goal:auto passes: a relative one would resolve inside the worktree, against that branch's
// older copy of the gate.
const SELF = GATE.replace(/^node\s+/, '').replace(/scripts\/goal-gate\.ts$/, 'workflows/goal-auto.js');

const parseTracks = (output) =>
  output
    .split('\n')
    .filter((line) => line.startsWith('track\t'))
    .map((line) => line.split('\t'))
    .map(([, suffix, name, iterations, prepare, teardown]) => ({
      suffix,
      name,
      iterations: (iterations ?? '').split(' ').filter((entry) => entry !== ''),
      prepare: (prepare ?? '').trim(),
      teardown: (teardown ?? '').trim(),
    }));

// One worktree per track, branched from the default branch so every pull request is
// independently mergeable, and a teardown on every exit path — a preparation that brought
// containers up and then failed must not leave them up. A halted track keeps its worktree: it
// holds the state the developer needs.
const runTrack = async (track) => {
  const dir = `.worktrees/${WORK_ID}-${track.suffix}`;
  const branch = `feature/${WORK_ID}-${track.suffix}`;
  const created = await runner(
    `git worktree add ${dir} -b ${branch} "$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo main)"`,
    `worktree:${track.suffix}`,
    'Tracks',
  );

  if (created.exitCode !== 0) {
    return { status: 'refused', track: track.suffix, landed: [], notAttempted: track.iterations, detail: created.output };
  }

  const finish = async (report) => {
    if (track.teardown !== '') {
      await runner(`cd ${dir} && ${track.teardown}`, `teardown:${track.suffix}`, 'Tracks');
    }

    if (report.status === 'done') {
      await runner(`git worktree remove ${dir}`, `remove:${track.suffix}`, 'Tracks');
    }

    return { ...report, track: track.suffix, worktree: report.status === 'done' ? undefined : dir };
  };

  if (track.prepare !== '') {
    const prepared = await runner(`cd ${dir} && ${track.prepare}`, `prepare:${track.suffix}`, 'Tracks');

    if (prepared.exitCode !== 0) {
      return finish({
        status: 'refused',
        landed: [],
        notAttempted: track.iterations,
        detail: `The declared preparation failed, so no iteration was attempted:\n${prepared.output}`,
      });
    }
  }

  return finish(
    await workflow(
      { scriptPath: SELF },
      { plan: PLAN, gate: GATE, dir, track: track.suffix, iterations: track.iterations },
    ),
  );
};

if (typeof PLAN !== 'string' || PLAN === '') {
  throw new Error('goal-auto needs args.plan: the repo-relative path of a locked plan.');
}

phase('Survey');

const lock =
  TRACK === undefined ? await runner(`${GATE} lock ${PLAN}`, 'lock', 'Survey') : { exitCode: 0, output: '' };

// The lock is not held, so this exit path is the one that must not release it.
if (lock.exitCode !== 0) {
  return { status: 'refused', plan: PLAN, landed: [], notAttempted: [], detail: lock.output };
}

// Independence is proven before a worktree exists, and a halted track never cancels a healthy
// one: parallel() resolves a thrown thunk to null instead of rejecting, so a sibling's failure
// cannot take down a track that is provably fine.
if (TRACK === undefined) {
  const listed = await runner(`${GATE} tracks ${PLAN}`, 'tracks', 'Survey');

  if (listed.exitCode !== 0) {
    await release();

    return { status: 'refused', plan: PLAN, landed: [], notAttempted: [], detail: listed.output };
  }

  const tracks = parseTracks(listed.output);

  if (tracks.length > 0) {
    log(`${tracks.length} independent track(s): ${tracks.map((track) => track.suffix).join(' ')}`);
    phase('Tracks');

    const reports = (await parallel(tracks.map((track) => () => runTrack(track)))).map(
      (report, index) =>
        report ?? {
          status: 'refused',
          track: tracks[index]?.suffix,
          landed: [],
          notAttempted: tracks[index]?.iterations ?? [],
          detail: 'The track returned nothing: it was skipped, or it died after retries.',
        },
    );

    await release();

    const broken = reports.filter((report) => report.status !== 'done');

    return {
      status: broken.length === 0 ? 'done' : 'halted',
      plan: PLAN,
      tracks: reports,
      landed: reports.flatMap((report) => report.landed ?? []),
      notAttempted: reports.flatMap((report) => report.notAttempted ?? []),
      detail: broken.map((report) => `[${report.track}] ${report.status}\n${report.detail ?? ''}`).join('\n\n'),
    };
  }
}

// A child is told which iterations are its own, so it parses a list it was handed rather than
// reading the plan a second time.
const survey =
  TRACK === undefined
    ? await runner(`${SURVEY} ${PLAN}`, 'survey', 'Survey')
    : { exitCode: 0, output: (args?.iterations ?? []).join('\n') };

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
} else if (TRACK === undefined) {
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
const shipping = { pushed: false, pr: false, blocked: undefined, prError: undefined };
let stopped;

// The pull request is opened as a draft at the **first** commit and its body rewritten by every
// iteration after it, so a run that halts at iteration 3 of 15 still leaves something a human
// can read instead of a local branch nobody can see.
const mirror = async (issue) => {
  if (shipping.blocked !== undefined) {
    return;
  }

  if (!shipping.pushed && !(await reshape(landed.length))) {
    shipping.blocked =
      'The run carries a fixup or squash commit, so the history is not the sequence a reviewer should read. Nothing was pushed: fold them yourself, then push.';

    return;
  }

  const push = await pushBranch();

  if (!push.pushed) {
    shipping.blocked = push.scanned
      ? `The push failed:\n${push.detail.slice(-1500)}`
      : `The secret scanner refused this tree, so nothing was pushed:\n${push.detail.slice(-1500)}`;

    return;
  }

  shipping.pushed = true;

  const facts = await planFacts(landed);
  const published = await publish(shipping.pr ? 'edit' : 'create', facts, prBody(facts, issue));

  shipping.prError = published.exitCode === 0 ? undefined : published.output.slice(-1500);
  shipping.pr = shipping.pr || published.exitCode === 0;
};

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
    const gate = await runner(
      inDir(`${GATE} commit ${PLAN_PATH} ${iteration} ${hash}`),
      `gate:${iteration}`,
      'Iterate',
    );

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

    if (landed.length > 0) {
      await mirror(issue);
      report.push = { pushed: shipping.pushed, detail: shipping.blocked ?? shipping.prError ?? '' };
      report.pr = shipping.pr;
    } else {
      report.push = await pushBranch();
    }

    if (issue !== undefined) {
      report.reported = (await post(`issue #${issue}`, 'run halted', haltReport(report))).exitCode === 0;
    }

    return report;
  }

  landed.push(iteration);
  log(`iteration ${iteration} landed, gate-verified`);

  await mirror(issue);
}

await release();

phase('Ship');

// Nothing ships unverified: every slice was gated against its own commands, which is not the
// same claim as the whole plan holding. Marking the pull request ready is what "shipped" means
// here, and it happens on the other side of this barrier or not at all.
const dod = await runner(inDir(`${GATE} dod ${PLAN_PATH} ${hash}`), 'dod', 'Ship');

if (dod.exitCode !== 0) {
  const refused = {
    status: 'halted',
    plan: PLAN,
    iteration: 'the global Definition of Done',
    detail: dod.output,
    landed,
    notAttempted: [],
    push: { pushed: shipping.pushed, detail: shipping.blocked ?? shipping.prError ?? '' },
    pr: shipping.pr,
  };

  if (issue !== undefined) {
    refused.reported = (await post(`issue #${issue}`, 'run halted', haltReport(refused))).exitCode === 0;
  }

  return refused;
}

const ready = shipping.pr ? await runner(inDir('gh pr ready'), 'pr:ready', 'Ship') : undefined;

return {
  status: 'done',
  plan: PLAN,
  landed,
  notAttempted: [],
  pushed: shipping.pushed,
  pr: shipping.pr,
  ready: ready?.exitCode === 0,
  detail: shipping.blocked ?? shipping.prError ?? ready?.output ?? '',
};
