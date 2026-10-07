import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

import { tmpDir } from './support/tmp.ts';

const root = join(import.meta.dirname, '..');

const runner = [
  ...readdirSync(join(root, 'src', 'run')).filter((file) => file.endsWith('.ts')).map((file) => join('src', 'run', file)),
  join('src', 'core', 'events.ts'),
  join('scripts', 'goal-run.ts'),
];

const adapterImport = /^import .* from '\.\.\/src\/adapters\/claude\/(?:session|warning|postmortem)\.ts';$/;

const CLAUDE_TOKENS: [string, RegExp, string][] = [
  ['the claude binary', /['"`]claude['"`]/, "spawn('claude'"],
  ['--agent', /--agent\b/, 'x --agent y'],
  ['--permission-mode', /--permission-mode/, '--permission-mode'],
  ['--output-format', /--output-format/, '--output-format'],
  ['stream-json', /stream-json/, 'stream-json'],
  ['~/.claude', /~\/\.claude/, '~/.claude/projects'],
  ['DISABLE_AUTOUPDATER', /DISABLE_AUTOUPDATER/, "DISABLE_AUTOUPDATER: '1'"],
  ['a goal-run agent id', /goal:goal-run-/, "'goal:goal-run-lens'"],
];

const leaks = (file: string): string[] =>
  readFileSync(join(root, file), 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      adapterImport.test(line) ? [] : CLAUDE_TOKENS.filter(([, pattern]) => pattern.test(line)).map(([name]) => `${file}:${index + 1} names ${name}`),
    );

// R9 — nothing Claude-specific remains in the runner outside Claude's adapter.
test('no runner module outside the adapter names a Claude binary, flag, event shape or home directory', () => {
  assert.deepEqual(runner.flatMap(leaks), []);
});

// R9 — the guard fails when a token reappears.
test('the provider-neutral guard recognises each Claude token it forbids', () => {
  for (const [name, pattern, sample] of CLAUDE_TOKENS) {
    assert.ok(pattern.test(sample), name);
  }
});

const sourcesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourcesUnder(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  );

const parse = (file: string): ts.SourceFile => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

const specifiersOf = (source: ts.SourceFile): string[] =>
  source.statements.flatMap((statement) =>
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );

const targetsOf = (file: string): string[] =>
  specifiersOf(parse(file))
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => resolve(dirname(file), specifier));

const inside = (path: string, dir: string): boolean => path === dir || path.startsWith(dir + sep);

const PATH_FIELD = /path$/i;

const pathFieldsOf = (source: ts.SourceFile, name: string, seen: Set<string> = new Set()): string[] => {
  if (seen.has(name)) {
    return [];
  }

  seen.add(name);

  const declaration = source.statements.find((statement): statement is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(statement) && statement.name.text === name);

  if (declaration === undefined) {
    return [];
  }

  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertySignature(node) && ts.isIdentifier(node.name) && PATH_FIELD.test(node.name.text)) {
      found.push(node.name.text);
    }

    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      found.push(...pathFieldsOf(source, node.typeName.text, seen));
    }

    ts.forEachChild(node, visit);
  };

  visit(declaration.type);

  return found;
};

const boundaryFindings = (srcDir: string): string[] => {
  const adapters = join(srcDir, 'adapters');
  const run = join(srcDir, 'run');
  const events = join(srcDir, 'core', 'events.ts');
  const ports = join(srcDir, 'ports.ts');
  const name = (file: string): string => relative(dirname(srcDir), file);
  const providerOf = (target: string): boolean => inside(target, adapters) && relative(adapters, target).includes(sep);
  const found: string[] = [];

  for (const file of sourcesUnder(adapters)) {
    for (const target of targetsOf(file)) {
      if (inside(target, run)) {
        found.push(`${name(file)} imports from src/run/`);
      }
    }
  }

  for (const file of sourcesUnder(run)) {
    for (const target of targetsOf(file)) {
      if (providerOf(target)) {
        found.push(`${name(file)} imports from a provider adapter directory`);
      }
    }
  }

  const portSource = parse(ports);

  for (const specifier of specifiersOf(portSource)) {
    if (specifier.startsWith('.') && resolve(dirname(ports), specifier).replace(/\.ts$/, '') === events.replace(/\.ts$/, '')) {
      found.push(`${name(ports)} names a type from core/events.ts`);
    }
  }

  for (const field of pathFieldsOf(portSource, 'AgentReport')) {
    found.push(`${name(ports)} declares the path field ${field} in AgentReport`);
  }

  return found;
};

const scratch = (files: Record<string, string>): string => {
  const base = tmpDir('provider-neutral-');
  const defaults: Record<string, string> = {
    'src/ports.ts': 'export type AgentReport = { stderr: string };\n',
    'src/core/events.ts': 'export type Event = { kind: string };\n',
    'src/run/iteration.ts': "export const iterate = 1;\n",
    'src/adapters/fs.ts': "export const fs = 1;\n",
    'src/adapters/claude/session.ts': "export const session = 1;\n",
  };

  for (const [file, content] of Object.entries({ ...defaults, ...files })) {
    mkdirSync(dirname(join(base, file)), { recursive: true });
    writeFileSync(join(base, file), content);
  }

  return join(base, 'src');
};

// R9 — the delivered tree honours both import directions and the neutral port contract.
test('the delivered tree crosses no adapter/runner boundary and keeps the port neutral', () => {
  assert.deepEqual(boundaryFindings(join(root, 'src')), []);
});

// R9 — permitted neighbors stay green: shared infrastructure, composition roots, in-adapter and port-only imports.
test('the boundary guard stays green for the permitted neighbors', () => {
  const src = scratch({
    'src/run/uses-shared.ts': "import { fs } from '../adapters/fs.ts';\nimport type { AgentReport } from '../ports.ts';\nexport const x = fs;\n",
    'src/adapters/claude/more.ts': "import { session } from './session.ts';\nimport { fs } from '../fs.ts';\nexport const y = [session, fs];\n",
    'src/adapters/fs-user.ts': "import type { AgentReport } from '../ports.ts';\nexport type R = AgentReport;\n",
    'scripts/goal-run.ts': "import { session } from '../src/adapters/claude/session.ts';\nexport const z = session;\n",
    'src/ports.ts': "export type Opaque = { providerData?: unknown };\nexport type AgentReport = { stderr: string; providerData?: Opaque };\nexport type AgentOptions = { outPath: string };\n",
  });

  assert.deepEqual(boundaryFindings(src), []);
});

// R9 — each forbidden edge names its file, including a provider that does not exist yet.
for (const [name, file, content, expected] of [
  ['an adapter importing the runner', 'src/adapters/claude/leak.ts', "import { iterate } from '../../run/iteration.ts';\nexport const a = iterate;\n", 'src/adapters/claude/leak.ts'],
  ['a shared adapter importing the runner', 'src/adapters/shared.ts', "export { iterate } from './../run/iteration.ts';\n", 'src/adapters/shared.ts'],
  ['a nested adapter file type-importing the runner', 'src/adapters/claude/deep/leak.ts', "import type { iterate } from '../../../run/iteration.ts';\nexport type A = typeof iterate;\n", 'src/adapters/claude/deep/leak.ts'],
  ['the runner importing Claude\'s adapter', 'src/run/leak.ts', "import { session } from '../adapters/claude/session.ts';\nexport const b = session;\n", 'src/run/leak.ts'],
  ['the runner re-exporting a provider adapter', 'src/run/reexport.ts', "export { session } from '../adapters/claude/session.ts';\n", 'src/run/reexport.ts'],
  ['the runner type-importing a future provider', 'src/run/future.ts', "import type { Thing } from '../adapters/futuristic/thing.ts';\nexport type T = Thing;\n", 'src/run/future.ts'],
  ['a nested runner file importing a future provider', 'src/run/sub/future.ts', "import { thing } from '../../adapters/futuristic/thing.ts';\nexport const t = thing;\n", 'src/run/sub/future.ts'],
  ['the port importing core/events', 'src/ports.ts', "import type { Event } from './core/events.ts';\nexport type AgentReport = { stderr: string; event?: Event };\n", 'src/ports.ts'],
  ['the port declaring a path field in AgentReport', 'src/ports.ts', 'export type AgentReport = { stderr: string; outPath: string };\n', 'src/ports.ts'],
  ['the port hiding a path field in a type AgentReport references', 'src/ports.ts', 'export type Files = { errPath: string };\nexport type AgentReport = { stderr: string; files: Files };\n', 'src/ports.ts'],
] as const) {
  test(`the boundary guard names the file for ${name}`, () => {
    const src = scratch({ ...(file === 'src/adapters/claude/leak.ts' || file.startsWith('src/run/') || file.startsWith('src/adapters/') ? { 'src/adapters/futuristic/thing.ts': 'export const thing = 1;\nexport type Thing = number;\n' } : {}), [file]: content });

    const findings = boundaryFindings(src);

    assert.ok(
      findings.some((finding) => finding.startsWith(expected)),
      `expected a finding for ${expected}, got ${JSON.stringify(findings)}`,
    );
  });
}
