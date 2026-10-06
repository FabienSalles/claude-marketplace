#!/usr/bin/env node
// Certifies a single skill directory against three levels: 2 (agentskills spec, blocking), 3
// (hard platform limits from VS Code Copilot and the Codex loader, blocking), 4 (authoring
// advisories, non-blocking). A skill whose SKILL.md is missing or malformed fails levels 2 and 3
// rather than being skipped — certification stays fail-closed.
//
// Usage: node certify.ts <skill-dir | plugin-dir>
//
// A plugin directory (one with a `skills/` subdirectory but no SKILL.md of its own) certifies
// every skill it contains and aggregates their verdicts into a single exit code.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { certifyAgent } from '../src/agents.ts';
import { runDiffGate } from '../src/diff.ts';
import { evalsFindings, listEvals } from '../src/evals.ts';
import { readFrontmatter } from '../src/frontmatter.ts';
import { installSandboxed, PINNED_SKILLS_CLI, type InstallResult, type SkillInstall } from '../src/install.ts';
import { certifyPluginStructure } from '../src/plugin-structure.ts';
import { listAgents, listSkills, type SkillRef } from '../src/repo-coherence.ts';
import { level2Findings } from '../src/rules/level2.ts';
import { level3Findings } from '../src/rules/level3.ts';
import { level4Findings } from '../src/rules/level4-advisory.ts';
import { computeStock, renderStock } from '../src/stock.ts';
import { validateUpstream } from '../src/upstream.ts';
import { aggregateLevel, aggregateVerdict, type Finding, type LevelVerdict, type Verdict } from '../src/verdict.ts';

export const certify = (skillDir: string): Verdict => {
  const frontmatterResult = readFrontmatter(skillDir);

  if (!frontmatterResult.ok) {
    const unreadable: Finding = {
      rule: 'frontmatter-readable',
      status: 'fail',
      detail: frontmatterResult.reason,
      source: 'agentskills.io/specification',
    };

    return aggregateVerdict(skillDir, [
      aggregateLevel(2, true, [unreadable]),
      aggregateLevel(3, true, [unreadable]),
      aggregateLevel(4, false, [unreadable]),
    ]);
  }

  const { frontmatter } = frontmatterResult;
  const levels: LevelVerdict[] = [
    aggregateLevel(2, true, level2Findings(frontmatter)),
    aggregateLevel(3, true, level3Findings(frontmatter)),
    aggregateLevel(4, false, level4Findings(skillDir)),
  ];

  return aggregateVerdict(skillDir, levels);
};

// I7 — with --require-evals, a skill missing evals/evals.json (or with an empty routing array)
// fails certification: a skill ships its own evidence that it triggers on the right prompts.
export const requireEvalsFinding = (skillDir: string): Finding => {
  const evalsPath = join(skillDir, 'evals', 'evals.json');

  if (!existsSync(evalsPath)) {
    return { rule: 'evals-present', status: 'fail', detail: `missing ${evalsPath}`, source: 'skills:plugin-conventions' };
  }

  const parsed = JSON.parse(readFileSync(evalsPath, 'utf8'));

  if (!Array.isArray(parsed.routing) || parsed.routing.length === 0) {
    return { rule: 'evals-present', status: 'fail', detail: `${evalsPath} has no routing cases`, source: 'skills:plugin-conventions' };
  }

  return { rule: 'evals-present', status: 'pass', detail: `${evalsPath} has ${parsed.routing.length} routing case(s)`, source: 'skills:plugin-conventions' };
};

export const renderVerdict = (verdict: Verdict): string => {
  const lines: string[] = [`Certification: ${verdict.skillDir}`];

  for (const level of verdict.levels) {
    lines.push(`\nLevel ${level.level}${level.blocking ? '' : ' (advisory)'} — ${level.status.toUpperCase()}`);

    for (const finding of level.findings) {
      lines.push(`  [${finding.status.toUpperCase()}] ${finding.rule}: ${finding.detail} (source: ${finding.source})`);
    }
  }

  lines.push(`\nOverall: ${verdict.status.toUpperCase()}`);

  return lines.join('\n');
};

type TreeCertification = {
  readonly skills: readonly Verdict[];
  readonly agents: readonly Verdict[];
  readonly evals: readonly Verdict[];
};

const certifyTree = (repoRoot: string, skills: readonly SkillRef[]): TreeCertification => ({
  skills: skills.map((skill) => certify(skill.dir)),
  agents: listAgents(repoRoot).map((agentPath) => certifyAgent(agentPath, join(repoRoot, 'plugins'))),
  evals: listEvals(repoRoot, skills).map((evalsPath) =>
    aggregateVerdict(evalsPath, [aggregateLevel(2, true, evalsFindings(evalsPath, skills))]),
  ),
});

const findingLine = (tag: 'FAIL' | 'WARN', path: string, finding: Finding): string =>
  `[${tag}] ${path} ${finding.rule}: ${finding.detail} (source: ${finding.source})`;

const failingLines = (verdicts: readonly Verdict[], repoRoot: string): string[] =>
  verdicts.flatMap((verdict) =>
    verdict.levels.flatMap((level) =>
      level.findings
        .filter((finding) => finding.status === 'fail')
        .map((finding) => findingLine(level.blocking ? 'FAIL' : 'WARN', relative(repoRoot, verdict.skillDir), finding)),
    ),
  );

const failingFindings = (verdicts: readonly Verdict[], blocking: boolean): number =>
  verdicts
    .flatMap((verdict) => verdict.levels)
    .filter((level) => level.blocking === blocking)
    .flatMap((level) => level.findings)
    .filter((finding) => finding.status === 'fail').length;

const renderTreeCertification = (tree: TreeCertification, repoRoot: string): string => {
  const verdicts = [...tree.skills, ...tree.agents, ...tree.evals];

  return [
    ...failingLines(verdicts, repoRoot),
    `Certified ${tree.skills.length} skill(s), ${tree.agents.length} agent(s), ${tree.evals.length} evals file(s): ` +
      `${failingFindings(verdicts, true)} blocking failure(s), ${failingFindings(verdicts, false)} advisory finding(s)`,
  ].join('\n');
};

const renderUpstream = (verdicts: readonly Verdict[], repoRoot: string): string =>
  [
    ...failingLines(verdicts, repoRoot),
    `Upstream skills-ref validation of ${verdicts.length} skill(s): ` +
      `${failingFindings(verdicts, true)} failure(s), ${failingFindings(verdicts, false)} declared divergence(s)`,
  ].join('\n');

const installFailures = (install: SkillInstall, cli: string): Finding[] => {
  const failures: Finding[] = [];

  if (install.missingFiles.length > 0) {
    failures.push({ rule: 'install-files-complete', status: 'fail', detail: `missing ${install.missingFiles.join(', ')}`, source: cli });
  }

  if (!install.lockEntryFound) {
    failures.push({ rule: 'install-lock-entry', status: 'fail', detail: 'no entry in skills-lock.json', source: cli });
  }

  return failures;
};

const renderInstall = (result: InstallResult, cli: string, repoRoot: string): string => {
  const lines = result.installs.flatMap((install) =>
    installFailures(install, cli).map((finding) => findingLine('FAIL', relative(repoRoot, install.dir), finding)),
  );

  return [...lines, `Sandboxed install of ${result.installs.length} skill(s) with ${cli}: ${lines.length} failure(s)`].join('\n');
};

const renderNpxFailure = (code: string, cli: string, skillCount: number): string =>
  [
    findingLine('FAIL', '.', { rule: 'install-run', status: 'fail', detail: `npx failed with code ${code}`, source: cli }),
    `Sandboxed install of ${skillCount} skill(s) with ${cli}: 1 failure(s)`,
  ].join('\n');

const treeSkills = (repoRoot: string): SkillRef[] => {
  const skills = listSkills(repoRoot);

  if (skills.length === 0) {
    process.stderr.write(`no skill found under ${join(repoRoot, 'plugins')}\n`);
    process.exit(1);
  }

  return skills;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const requireEvals = args.includes('--require-evals');
  const [flag, arg] = args.filter((a) => a !== '--require-evals');

  if (flag === '--stock') {
    process.stdout.write(`${renderStock(computeStock(process.cwd()))}\n`);
    process.exit(0);
  }

  if (flag === '--all') {
    const repoRoot = process.cwd();
    const tree = certifyTree(repoRoot, treeSkills(repoRoot));
    const failed = [...tree.skills, ...tree.agents, ...tree.evals].some((verdict) => verdict.status === 'fail');

    process.stdout.write(`${renderTreeCertification(tree, repoRoot)}\n`);
    process.exit(failed ? 1 : 0);
  }

  if (flag === '--install-all') {
    const cliIndex = args.indexOf('--cli');
    const cli = cliIndex === -1 ? PINNED_SKILLS_CLI : args[cliIndex + 1];

    if (cli === undefined || cli === '') {
      process.stderr.write('usage: certify.ts --install-all [--cli <npm spec>]\n');
      process.exit(2);
    }

    const repoRoot = process.cwd();
    const skills = treeSkills(repoRoot);
    const result = await installSandboxed(repoRoot, skills, cli).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && 'stderr' in error)) {
        throw error;
      }

      process.stderr.write(String(error.stderr));
      process.stdout.write(`${renderNpxFailure(String(error.code), cli, skills.length)}\n`);
      process.exit(1);
    });

    process.stdout.write(`${renderInstall(result, cli, repoRoot)}\n`);
    process.exit(result.ok ? 0 : 1);
  }

  if (flag === '--upstream') {
    const repoRoot = process.cwd();
    const result = validateUpstream(treeSkills(repoRoot));

    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }

    process.stdout.write(`${renderUpstream(result.verdicts, repoRoot)}\n`);
    process.exit(result.verdicts.some((verdict) => verdict.status === 'fail') ? 1 : 0);
  }

  if (flag === '--diff') {
    if (arg === undefined || arg === '') {
      process.stderr.write('usage: certify.ts --diff <base-ref>\n');
      process.exit(2);
    }

    const result = runDiffGate(arg, process.cwd());

    for (const verdict of result.verdicts) {
      process.stdout.write(`${renderVerdict(verdict)}\n`);
    }

    process.exit(result.status === 'fail' ? 1 : 0);
  }

  if (flag === '--install') {
    if (arg === undefined || arg === '') {
      process.stderr.write('usage: certify.ts --install <skill-dir>\n');
      process.exit(2);
    }

    const frontmatterResult = readFrontmatter(arg);

    if (!frontmatterResult.ok) {
      process.stderr.write(`${frontmatterResult.reason}\n`);
      process.exit(1);
    }

    const result = await installSandboxed(arg, [{ name: String(frontmatterResult.frontmatter.fields.name), dir: arg }]);

    for (const install of result.installs) {
      process.stdout.write(`Install: ${install.name}\n`);
      process.stdout.write(`  files complete: ${install.missingFiles.length === 0 ? 'yes' : `no (missing: ${install.missingFiles.join(', ')})`}\n`);
      process.stdout.write(`  skills-lock.json entry: ${install.lockEntryFound ? 'yes' : 'no'}\n`);
    }

    process.exit(result.ok ? 0 : 1);
  }

  const target = flag;

  if (target === undefined || target === '') {
    process.stderr.write(
      'usage: certify.ts <skill-dir | plugin-dir | agent-md-path> [--require-evals] | --stock | --diff <base-ref> | --install <skill-dir>' +
        ' | --all | --install-all [--cli <npm spec>] | --upstream\n',
    );
    process.exit(2);
  }

  if (target.endsWith('.md')) {
    // plugins/<plugin>/agents/<agent>.md -> plugins is two levels above the agents dir.
    const verdict = certifyAgent(target, dirname(dirname(dirname(target))));
    process.stdout.write(`${renderVerdict(verdict)}\n`);
    process.exit(verdict.status === 'fail' ? 1 : 0);
  }

  const isPluginDir = !existsSync(join(target, 'SKILL.md')) && existsSync(join(target, 'skills'));

  if (isPluginDir) {
    const pluginName = target.replace(/\/+$/, '').split('/').pop();
    const repoRoot = dirname(dirname(target));
    const skills = listSkills(repoRoot).filter((skill) => skill.plugin === pluginName);
    const verdicts = skills.map((skill) => certify(skill.dir));

    for (const verdict of verdicts) {
      process.stdout.write(`${renderVerdict(verdict)}\n`);
    }

    let evalsFailed = false;

    if (requireEvals) {
      for (const skill of skills) {
        const finding = requireEvalsFinding(skill.dir);
        process.stdout.write(`  [${finding.status.toUpperCase()}] ${finding.rule}: ${finding.detail} (source: ${finding.source})\n`);

        if (finding.status === 'fail') {
          evalsFailed = true;
        }
      }
    }

    process.exit(verdicts.some((verdict) => verdict.status === 'fail') || evalsFailed ? 1 : 0);
  }

  const isSkillLessPluginDir = !existsSync(join(target, 'SKILL.md')) && !existsSync(join(target, 'skills'));

  const verdict = isSkillLessPluginDir ? certifyPluginStructure(target) : certify(target);
  process.stdout.write(`${renderVerdict(verdict)}\n`);
  process.exit(verdict.status === 'fail' ? 1 : 0);
}
