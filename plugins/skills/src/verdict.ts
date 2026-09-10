export type Level = 2 | 3 | 4;

export type Status = 'pass' | 'fail';

export type Finding = {
  readonly rule: string;
  readonly status: Status;
  readonly detail: string;
  readonly source: string;
};

export type LevelVerdict = {
  readonly level: Level;
  readonly blocking: boolean;
  readonly status: Status;
  readonly findings: readonly Finding[];
};

export type Verdict = {
  readonly skillDir: string;
  readonly levels: readonly LevelVerdict[];
  readonly status: Status;
};

export const aggregateLevel = (level: Level, blocking: boolean, findings: readonly Finding[]): LevelVerdict => ({
  level,
  blocking,
  status: findings.some((finding) => finding.status === 'fail') ? 'fail' : 'pass',
  findings,
});

export const aggregateVerdict = (skillDir: string, levels: readonly LevelVerdict[]): Verdict => ({
  skillDir,
  levels,
  status: levels.some((level) => level.blocking && level.status === 'fail') ? 'fail' : 'pass',
});
