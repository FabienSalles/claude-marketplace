import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const plugin = resolve(import.meta.dirname, '..');
const skills = ['spec', 'plan', 'tickets', 'supervise', 'next'];
const documents = [
  'templates/goal-handoff.template', 'templates/post-merge.template', 'README.md',
  'docs/walkthrough.md', 'docs/autonomous-architecture.md', 'docs/loops.md',
  'docs/target-harness.md', 'agents/goal-run-auditor.md',
];

const fixture = (t: test.TestContext): string => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'goal-artifact-skills-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = spawnSync('git', ['init', '-q', directory], { encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);

  return directory;
};

const checkInstructions = (source: string): void => {
  assert.match(source, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/src\/artifacts\.ts" "\$project"/);
  assert.doesNotMatch(source, /\.claude\/(?:plans|goal-runs)/);
  assert.doesNotMatch(source, /versionPlans|locationAsked|Never commit the plan/);
  assert.doesNotMatch(source, /fallback.*(?:old|provider).*directory|require.*plans.*gitignored/i);
  assert.match(source, /Discover identifiers only in `<plans>`\. On a miss, ask for the full path and wait/);
  assert.match(source, /New associated documents go in `<plans>`\s+and include `Source plan: <absolute selected plan path>`/);
  assert.match(source, /Preserve every command and\s+path embedded in locked plans/);
  assert.match(source, /Git ignore rules determine planning-document versioning/);
  assert.match(source, /Tracked, ignored and external\s+plans are supported/);
  assert.match(source, /in-repository `<runs>\/` and the selected `<plan>\.run\.lock\/` and `<plan>\.tick\.lock\/`/);
  assert.match(source, /Do not ignore the whole artifact root/);
  assert.match(source, /Never write `\.git\/info\/exclude`/);
  assert.match(source, /--runs-path <absolute work-id history directory>/);
};

for (const skill of skills) {
  test(`R1/R3/R7/R12/R14, I1/I3: ${skill} prescribes configured discovery, source references and Git exclusions`, () => {
    const source = readFileSync(join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');

    checkInstructions(source);
  });

  test(`R13: ${skill} resolver command selects project-specific roots through isolated CLI fixtures`, (t) => {
    const first = fixture(t);
    const second = fixture(t);
    const nested = join(first, 'nested');
    mkdirSync(nested);
    writeFileSync(join(first, '.env'), 'UNRELATED=fixture-only\nGOAL_ROOT_PATH=project-root\n');
    writeFileSync(join(first, '.env.local'), 'GOAL_ROOT_PATH="local root"\n');
    writeFileSync(join(second, '.env'), `GOAL_ROOT_PATH="${join(second, 'absolute root')}"\n`);
    const source = readFileSync(join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
    const command = source.match(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/src\/artifacts\.ts" "\$project"/);
    assert.ok(command !== null, `${skill} must invoke the shared CLI`);
    const run = (project: string, value?: string) => spawnSync('bash', ['-c', command[0]], {
      cwd: project,
      env: { PATH: process.env.PATH, HOME: project, CLAUDE_PLUGIN_ROOT: plugin, project, ...(value === undefined ? {} : { GOAL_ROOT_PATH: value }) },
      encoding: 'utf8',
    });

    for (const [cwd, value, root, selectedSource] of [
      [nested, 'process root', join(first, 'process root'), 'environment'],
      [nested, undefined, join(first, 'local root'), '.env.local'],
      [second, undefined, join(second, 'absolute root'), '.env'],
    ] as const) {
      const result = run(cwd, value);

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        project: cwd === second ? second : first, root, plans: join(root, 'plans'),
        runs: join(root, 'runs'), source: selectedSource, supplied: true,
      });
      assert.doesNotMatch(result.stdout, /UNRELATED|fixture-only/);
    }
    const invalid = run(first, '');
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /empty or invalid/);
  });
}

test('R10/I6: spec prescribes absent and present branches, preserves unrelated content and carries the choice into the session', () => {
  const source = readFileSync(join(plugin, 'skills/spec/SKILL.md'), 'utf8');

  assert.match(source, /If `supplied` is false, ask for \*\*docs\/goal\/\*\*, \*\*\.goal\/\*\* or a \*\*custom path\*\* and\s+wait for the answer/);
  assert.match(source, /If `supplied` is true, use the effective value without asking for a location/);
  assert.match(source, /Preserve all unrelated content; update only its assignment/);
  assert.match(source, /passing it as the resolver process's\s+`GOAL_ROOT_PATH`/);
  assert.match(source, /\.env` or `\.env\.local`/);
});

test('I1/I6: resolver sequence reports absence then chosen destinations without changing an explicit old plan', (t) => {
  const project = fixture(t);
  const old = join(project, '.claude', 'plans');
  mkdirSync(old, { recursive: true });
  const plan = join(old, 'old-spec.md');
  const content = '# Locked old plan\ncommand=.claude/plans/old-input.md\n';
  writeFileSync(plan, content);
  const run = (value?: string) => spawnSync('node', [join(plugin, 'src/artifacts.ts'), project], {
    env: { PATH: process.env.PATH, HOME: project, ...(value === undefined ? {} : { GOAL_ROOT_PATH: value }) }, encoding: 'utf8',
  });

  const absent = run();
  const chosen = run('docs/goal');

  assert.equal(absent.status, 0, absent.stderr);
  assert.deepEqual(JSON.parse(absent.stdout), {
    project, root: join(project, '.goal'), plans: join(project, '.goal/plans'),
    runs: join(project, '.goal/runs'), source: 'default', supplied: false,
  });
  assert.equal(chosen.status, 0, chosen.stderr);
  assert.deepEqual(JSON.parse(chosen.stdout), {
    project, root: join(project, 'docs/goal'), plans: join(project, 'docs/goal/plans'),
    runs: join(project, 'docs/goal/runs'), source: 'environment', supplied: true,
  });
  assert.equal(readFileSync(plan, 'utf8'), content);
});

for (const document of documents) {
  test(`${document} artifact instructions use the resolver and contain no retired destinations or ignored-plan refusal`, () => {
    const source = readFileSync(join(plugin, document), 'utf8');

    assert.doesNotMatch(source, /\.claude\/(?:plans|goal-runs)/);
    assert.doesNotMatch(source, /plan.*requires gitignored|plan directory visible to\s+git is a refusal/);
    assert.match(source, /shared artifact resolver|src\/artifacts\.ts/);
  });
}

for (const [name, instruction] of [
  ['stale destination', 'Always write .claude/plans/new-spec.md.'],
  ['old-directory fallback', 'On a miss, fallback to the old provider directory.'],
  ['forced ignored plans', 'Require all plans to be gitignored.'],
  ['obsolete configuration', 'Set locationAsked and versionPlans.'],
] as const) {
  test(`instruction checker rejects a temporary ${name} mutation`, (t) => {
    const directory = fixture(t);
    const path = join(directory, 'SKILL.md');
    const source = readFileSync(join(plugin, 'skills/spec/SKILL.md'), 'utf8');
    writeFileSync(path, `${source}\n${instruction}\n`);

    assert.throws(() => checkInstructions(readFileSync(path, 'utf8')), assert.AssertionError);
    checkInstructions(source);
  });
}
