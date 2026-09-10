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

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { certifyAgent } from '../src/agents.ts';
import { runDiffGate } from '../src/diff.ts';
import { readFrontmatter } from '../src/frontmatter.ts';
import { installSandboxed } from '../src/install.ts';
import { listSkills } from '../src/repo-coherence.ts';
import { level2Findings } from '../src/rules/level2.ts';
import { level3Findings } from '../src/rules/level3.ts';
import { level4Findings } from '../src/rules/level4-advisory.ts';
import { computeStock, renderStock } from '../src/stock.ts';
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

if (import.meta.main) {
  const [flag, arg] = process.argv.slice(2);

  if (flag === '--stock') {
    process.stdout.write(`${renderStock(computeStock(process.cwd()))}\n`);
    process.exit(0);
  }

  if (flag === '--diff') {
    if (!arg) {
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
    if (!arg) {
      process.stderr.write('usage: certify.ts --install <skill-dir>\n');
      process.exit(2);
    }

    const frontmatterResult = readFrontmatter(arg);

    if (!frontmatterResult.ok) {
      process.stderr.write(`${frontmatterResult.reason}\n`);
      process.exit(1);
    }

    const result = await installSandboxed(arg, String(frontmatterResult.frontmatter.fields.name));

    process.stdout.write(`Install: ${result.skillName}\n`);
    process.stdout.write(`  files complete: ${result.missingFiles.length === 0 ? 'yes' : `no (missing: ${result.missingFiles.join(', ')})`}\n`);
    process.stdout.write(`  skills-lock.json entry: ${result.lockEntryFound ? 'yes' : 'no'}\n`);
    process.exit(result.ok ? 0 : 1);
  }

  const target = flag;

  if (!target) {
    process.stderr.write('usage: certify.ts <skill-dir | plugin-dir | agent-md-path> | --stock | --diff <base-ref> | --install <skill-dir>\n');
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
    const verdicts = listSkills(repoRoot)
      .filter((skill) => skill.plugin === pluginName)
      .map((skill) => certify(skill.dir));

    for (const verdict of verdicts) {
      process.stdout.write(`${renderVerdict(verdict)}\n`);
    }

    process.exit(verdicts.some((verdict) => verdict.status === 'fail') ? 1 : 0);
  }

  const verdict = certify(target);
  process.stdout.write(`${renderVerdict(verdict)}\n`);
  process.exit(verdict.status === 'fail' ? 1 : 0);
}
