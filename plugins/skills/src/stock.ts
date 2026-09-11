import { listSkills, readmeCounterFindings, seePointerFindings } from './repo-coherence.ts';
import type { Finding } from './verdict.ts';

export type StockReport = {
  readonly count: number;
  readonly findings: readonly Finding[];
};

export const computeStock = (repoRoot: string): StockReport => {
  const skills = listSkills(repoRoot);

  return {
    count: skills.length,
    findings: [...readmeCounterFindings(repoRoot, skills), ...seePointerFindings(skills)],
  };
};

export const renderStock = (report: StockReport): string => {
  const lines = [`Stock: ${report.count} skill(s)`];
  const failing = report.findings.filter((finding) => finding.status === 'fail');

  for (const finding of failing) {
    lines.push(`  [WARN] ${finding.rule}: ${finding.detail} (source: ${finding.source})`);
  }

  return lines.join('\n');
};
