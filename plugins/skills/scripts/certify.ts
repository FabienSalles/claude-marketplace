#!/usr/bin/env node
// Certifies a single skill directory against three levels: 2 (agentskills spec, blocking), 3
// (hard platform limits from VS Code Copilot and the Codex loader, blocking), 4 (authoring
// advisories, non-blocking). A skill whose SKILL.md is missing or malformed fails levels 2 and 3
// rather than being skipped — certification stays fail-closed.
//
// Usage: node certify.ts <skill-dir>

import { readFrontmatter } from '../src/frontmatter.ts';
import { level2Findings } from '../src/rules/level2.ts';
import { level3Findings } from '../src/rules/level3.ts';
import { level4Findings } from '../src/rules/level4-advisory.ts';
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
  const [skillDir] = process.argv.slice(2);

  if (!skillDir) {
    process.stderr.write('usage: certify.ts <skill-dir>\n');
    process.exit(2);
  }

  const verdict = certify(skillDir);
  process.stdout.write(`${renderVerdict(verdict)}\n`);
  process.exit(verdict.status === 'fail' ? 1 : 0);
}
