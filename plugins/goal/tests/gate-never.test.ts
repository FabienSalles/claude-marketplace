import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GATE = resolve(import.meta.dirname, '..', 'scripts', 'goal-gate.ts');

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const planWith = (gateLines: string[], header: string[] = []): string =>
  [
    ...header,
    '',
    '### Iteration 1 — A slice',
    '- [ ] Not done yet',
    '',
    '```gate',
    ...gateLines,
    '```',
    '',
  ].join('\n');

const GATE_BLOCK = [
  'test_files=tests/a.test.ts',
  'impl_files=src/a.ts',
  'commit_msg=feat(a): do a thing',
  'gate1=grep -q "a = 2" src/a.ts',
];

const fixture = (
  gateLines: string[] = GATE_BLOCK,
  header: string[] = [],
): { repo: string; plan: string } => {
  const repo = mkdtempSync(join(tmpdir(), 'goal-gate-never-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'gate@example.com');
  git(repo, 'config', 'user.name', 'Gate');
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'tests', 'a.test.ts'), 'export const t = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');

  const plan = join(mkdtempSync(join(tmpdir(), 'goal-gate-never-plan-')), 'spec.md');
  writeFileSync(plan, planWith(gateLines, header));

  return { repo, plan };
};

const runGate = (repo: string, ...args: string[]): { code: number; output: string } => {
  const run = spawnSync('node', [GATE, ...args], { cwd: repo, encoding: 'utf8' });

  return { code: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
};

const touchDeclared = (repo: string): void => {
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
};

// N1 — a .env in the tree halts the iteration even though nothing declared it
test('an undeclared .env halts before the scope check', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  writeFileSync(join(repo, '.env'), 'SUPABASE_KEY=sk_live_abc\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /must never be committed/);
  assert.match(output, /\.env/);
});

// N2 — declaring it does not make it committable: this is the rule a plan cannot opt out of
test('a .env declared in impl_files is refused rather than staged', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts .env',
    'commit_msg=feat(a): do a thing',
    'gate1=grep -q "a = 2" src/a.ts',
  ]);
  touchDeclared(repo);
  writeFileSync(join(repo, '.env'), 'SUPABASE_KEY=sk_live_abc\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /must never be committed/);
});

// N3 — the documented counter-example every project ships stays committable
test('.env.example is not refused', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts .env.example',
    'commit_msg=feat(a): do a thing',
    'gate1=grep -q "a = 2" src/a.ts',
  ]);
  touchDeclared(repo);
  writeFileSync(join(repo, '.env.example'), 'SUPABASE_KEY=\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// N4 — vendored dependencies are never versioned either
test('a node_modules path is refused', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  mkdirSync(join(repo, 'node_modules', 'left-pad'), { recursive: true });
  writeFileSync(join(repo, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /must never be committed/);
  assert.match(output, /node_modules/);
});

// N5 — a private key is refused on its extension alone
test('a .pem file is refused', () => {
  const { repo, plan } = fixture();
  touchDeclared(repo);
  writeFileSync(join(repo, 'server.pem'), '-----BEGIN PRIVATE KEY-----\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /must never be committed/);
  assert.match(output, /server\.pem/);
});

// N6 — the incidental allowance does not reopen the door
test('a .env named on the Incidental header is still refused', () => {
  const { repo, plan } = fixture(GATE_BLOCK, ['Incidental: .env']);
  touchDeclared(repo);
  writeFileSync(join(repo, '.env'), 'SUPABASE_KEY=sk_live_abc\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /must never be committed/);
});

// N7 — a path merely containing "env" is not a secret
test('a source file whose name contains env is left alone', () => {
  const { repo, plan } = fixture([
    'test_files=tests/a.test.ts',
    'impl_files=src/a.ts src/env.ts',
    'commit_msg=feat(a): do a thing',
    'gate1=grep -q "a = 2" src/a.ts',
  ]);
  touchDeclared(repo);
  writeFileSync(join(repo, 'src', 'env.ts'), 'export const env = 1;\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});

// N8 — the whole point: generated tooling declared once on the plan header no longer halts,
// and lands in the commit rather than being waved through and left behind
test('an incidental path is tolerated, then committed', () => {
  const { repo, plan } = fixture(GATE_BLOCK, ['Incidental: tsconfig.json pnpm-lock.yaml']);
  touchDeclared(repo);
  writeFileSync(join(repo, 'tsconfig.json'), '{"compilerOptions":{}}\n');
  writeFileSync(join(repo, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");

  const verified = runGate(repo, 'verify', plan, '1');

  assert.equal(verified.code, 0, verified.output);

  const committed = runGate(repo, 'commit', plan, '1');

  assert.equal(committed.code, 0, committed.output);

  const tracked = git(repo, 'ls-files').stdout;

  assert.match(tracked, /tsconfig\.json/);
  assert.match(tracked, /pnpm-lock\.yaml/);
  assert.match(readFileSync(plan, 'utf8'), /- \[x\]/);
});

// N9 — tolerance is not blanket permission: anything not declared and not incidental still halts
test('an unrelated file still halts when incidental is declared', () => {
  const { repo, plan } = fixture(GATE_BLOCK, ['Incidental: tsconfig.json']);
  touchDeclared(repo);
  writeFileSync(join(repo, 'tsconfig.json'), '{"compilerOptions":{}}\n');
  writeFileSync(join(repo, 'unrelated.ts'), 'export const stray = 1;\n');

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 1);
  assert.match(output, /Scope leak/);
  assert.match(output, /unrelated\.ts/);
  assert.doesNotMatch(output, /Changed but not declared:.*tsconfig/);
});

// N10 — a lockfile is generated, not authored, so it must not consume the slice's budget
test('an incidental path does not count against max_diff', () => {
  const { repo, plan } = fixture(
    [
      'test_files=tests/a.test.ts',
      'impl_files=src/a.ts',
      'max_diff=5',
      'commit_msg=feat(a): do a thing',
      'gate1=grep -q "a = 2" src/a.ts',
    ],
    ['Incidental: pnpm-lock.yaml'],
  );
  touchDeclared(repo);
  writeFileSync(join(repo, 'pnpm-lock.yaml'), `${'entry: 1\n'.repeat(400)}`);

  const { code, output } = runGate(repo, 'verify', plan, '1');

  assert.equal(code, 0, output);
});
