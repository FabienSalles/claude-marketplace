import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CERTIFY = join(import.meta.dirname, '..', 'scripts', 'certify.ts');

const fixture = (name: string): string => join(import.meta.dirname, 'fixtures', name);

const emptyTree = (): string => mkdtempSync(join(tmpdir(), 'skills-cli-'));

const copyInto = (root: string, source: string, destination: string): void => {
  cpSync(source, join(root, destination), { recursive: true });
};

const writeInto = (root: string, destination: string, content: string): void => {
  mkdirSync(dirname(join(root, destination)), { recursive: true });
  writeFileSync(join(root, destination), content);
};

const certifyIn = (root: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(process.execPath, [CERTIFY, ...args], { cwd: root, encoding: 'utf8', env });

const UPSTREAM_ALLOWED = "Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.";

const stubCommand = (name: string, script: string): string => {
  const bin = mkdtempSync(join(tmpdir(), `skills-cli-${name}-`));
  writeFileSync(join(bin, name), script, { mode: 0o755 });

  return bin;
};

const replayedSkillsRef = (): string =>
  stubCommand('uvx', `#!/bin/sh
for last; do :; done
case "$last" in
  --version) echo 'skills-ref, version 0.1.0' ;;
  */claude-code-fields) printf '%s\\n' "Validation failed for $last:" "  - Unexpected fields in frontmatter: agent, context, disable-model-invocation, model, user-invocable. ${UPSTREAM_ALLOWED}" >&2; exit 1 ;;
  */unexpected-field) printf '%s\\n' "Validation failed for $last:" "  - Unexpected fields in frontmatter: version. ${UPSTREAM_ALLOWED}" >&2; exit 1 ;;
  */mixed-fields) printf '%s\\n' "Validation failed for $last:" "  - Unexpected fields in frontmatter: disable-model-invocation, version. ${UPSTREAM_ALLOWED}" >&2; exit 1 ;;
  */crashing) echo 'Traceback (most recent call last):' >&2; exit 1 ;;
  *) echo "Valid skill: $last" ;;
esac
`);

test('certify --all exits 0 on a compliant tree and reports an advisory finding without failing', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('long-body'), 'plugins/demo/skills/long-body');
    copyInto(root, fixture('agent-plugins/demo/skills/valid-skill'), 'plugins/demo/skills/valid-skill');
    copyInto(root, fixture('agents/valid.md'), 'plugins/demo/agents/valid-agent.md');
    writeInto(
      root,
      'plugins/demo/evals/evals.json',
      JSON.stringify({ routing: [{ query: 'Certify my skill', skills: ['demo:valid'], expected_behavior: ['loads demo:valid'] }] }),
    );

    const result = certifyIn(root, ['--all']);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^\[WARN\] plugins\/demo\/skills\/long-body body-max-lines: /m);
    assert.match(result.stdout, /^Certified 3 skill\(s\), 1 agent\(s\), 1 evals file\(s\): 0 blocking failure\(s\), 1 advisory finding\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --all exits 1 and names the rule a skill breaks', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('unexpected-field'), 'plugins/demo/skills/unexpected-field');

    const result = certifyIn(root, ['--all']);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      /^\[FAIL\] plugins\/demo\/skills\/unexpected-field frontmatter-field-whitelist: unexpected field\(s\): version\. .* \(source: agentskills\.io\/specification\)$/m,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --all exits 1 and names the rule an agent breaks', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('agents/bad-model.md'), 'plugins/demo/agents/bad-model.md');

    const result = certifyIn(root, ['--all']);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /^\[FAIL\] plugins\/demo\/agents\/bad-model\.md model-valid: model "gpt-5" /m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --all exits 1 and names an evals.json routing case whose skill does not resolve', () => {
  const root = emptyTree();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    writeInto(
      root,
      'plugins/demo/skills/valid/evals/evals.json',
      JSON.stringify({ routing: [{ query: 'Certify my skill', skills: ['demo:missing'], expected_behavior: ['loads demo:missing'] }] }),
    );

    const result = certifyIn(root, ['--all']);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /^\[FAIL\] plugins\/demo\/skills\/valid\/evals\/evals\.json evals-skills-exist: routing\[0\] names "demo:missing"/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --all exits 1 on a tree that holds no skill', () => {
  const root = emptyTree();

  try {
    const result = certifyIn(root, ['--all']);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /no skill found under /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('certify --upstream exits 0 when upstream rejects only the declared Claude Code fields', () => {
  const root = emptyTree();
  const bin = replayedSkillsRef();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('claude-code-fields'), 'plugins/demo/skills/claude-code-fields');

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      /^\[WARN\] plugins\/demo\/skills\/claude-code-fields skills-ref-declared-divergence: Unexpected fields in frontmatter: agent, context, disable-model-invocation, model, user-invocable\. /m,
    );
    assert.match(result.stdout, /^Upstream skills-ref validation of 2 skill\(s\): 0 failure\(s\), 1 declared divergence\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --upstream exits 1 and names an upstream error outside the declared divergences', () => {
  const root = emptyTree();
  const bin = replayedSkillsRef();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');
    copyInto(root, fixture('unexpected-field'), 'plugins/demo/skills/unexpected-field');

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      /^\[FAIL\] plugins\/demo\/skills\/unexpected-field skills-ref: Unexpected fields in frontmatter: version\. .* \(source: git\+https:\/\/github\.com\/agentskills\/agentskills#subdirectory=skills-ref\)$/m,
    );
    assert.match(result.stdout, /^Upstream skills-ref validation of 2 skill\(s\): 1 failure\(s\), 0 declared divergence\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --upstream exits 1 when upstream rejects a declared Claude Code field next to an undeclared one', () => {
  const root = emptyTree();
  const bin = replayedSkillsRef();

  try {
    writeInto(
      root,
      'plugins/demo/skills/mixed-fields/SKILL.md',
      '---\nname: mixed-fields\ndescription: "A skill with a Claude Code field next to an undeclared one."\ndisable-model-invocation: true\nversion: 1.0.0\n---\n\n# Mixed fields\n',
    );

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      /^\[FAIL\] plugins\/demo\/skills\/mixed-fields skills-ref: Unexpected fields in frontmatter: disable-model-invocation, version\. /m,
    );
    assert.match(result.stdout, /^Upstream skills-ref validation of 1 skill\(s\): 1 failure\(s\), 0 declared divergence\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --upstream exits 1 and fails a skill whose validator exits non-zero without a validation error', () => {
  const root = emptyTree();
  const bin = replayedSkillsRef();

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/crashing');

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      /^\[FAIL\] plugins\/demo\/skills\/crashing skills-ref: exited 1 without a validation error: Traceback \(most recent call last\):/m,
    );
    assert.match(result.stdout, /^Upstream skills-ref validation of 1 skill\(s\): 1 failure\(s\), 0 declared divergence\(s\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --upstream exits 1 and names uv when uvx is not on the PATH', () => {
  const root = emptyTree();
  const bin = mkdtempSync(join(tmpdir(), 'skills-cli-no-uvx-'));

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /^uvx not found .*install uv/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --upstream exits 1 and names the network when uvx cannot fetch the validator', () => {
  const root = emptyTree();
  const bin = stubCommand('uvx', "#!/bin/sh\nprintf '%s\\n' '  × Failed to resolve `--with` requirement' '  ╰─▶ Git operation failed' >&2\nexit 2\n");

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');

    const result = certifyIn(root, ['--upstream'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /^uvx could not fetch git\+https:\/\/github\.com\/agentskills\/agentskills#subdirectory=skills-ref: --upstream needs network access/m);
    assert.match(result.stderr, /Git operation failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --install-all runs npx add on every listed skill with the --cli spec, a sandboxed HOME and the caller npm cache', () => {
  const root = emptyTree();
  const log = join(root, 'npx.log');
  const bin = stubCommand('npx', `#!/bin/sh\nprintf '%s\\n' "$HOME" "$npm_config_cache" "$@" > '${log}'\n`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_cache'));

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');

    const result = certifyIn(root, ['--install-all', '--cli', 'skills@9.9.9-spy'], { ...env, PATH: bin });
    const [home, cache, ...argv] = readFileSync(log, 'utf8').trimEnd().split('\n');

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.deepEqual(argv, ['--yes', 'skills@9.9.9-spy', 'add', realpathSync(root), '--skill', 'valid', '--agent', 'claude-code', '--yes']);
    assert.match(home ?? '', /\/skills-install-[^/]+\/home$/);
    assert.equal(cache, join(homedir(), '.npm'));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('certify --install-all exits 1 with one failure line and passes the npm error through when npx fails', () => {
  const npmError = [
    'npm error code ETARGET',
    'npm error notarget No matching version found for skills@0.0.0-nope.',
    "npm error notarget In most cases you or one of your dependencies are requesting a package version that doesn't exist.",
    '',
  ].join('\n');
  const root = emptyTree();
  const bin = stubCommand('npx', `#!/bin/sh\nprintf '%s' "${npmError}" >&2\nexit 1\n`);

  try {
    copyInto(root, fixture('valid'), 'plugins/demo/skills/valid');

    const result = certifyIn(root, ['--install-all', '--cli', 'skills@0.0.0-nope'], { ...process.env, PATH: bin });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(
      result.stdout,
      '[FAIL] . install-run: npx failed with code 1 (source: skills@0.0.0-nope)\nSandboxed install of 1 skill(s) with skills@0.0.0-nope: 1 failure(s)\n',
    );
    assert.equal(result.stderr, npmError);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});
