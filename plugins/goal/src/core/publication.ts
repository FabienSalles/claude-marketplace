export type PrDecision = { kind: 'create' } | { kind: 'edit' } | { kind: 'pause'; reason: string };

export type PlanEntry = { number: string; goal: string; subject: string; sha?: string | undefined };
export type CommitRef = { sha: string; subject: string };

const commitOf = (entry: PlanEntry, log: readonly CommitRef[]): CommitRef | undefined =>
  entry.sha !== undefined ? { sha: entry.sha, subject: entry.subject } : log.find((commit) => commit.subject === entry.subject);

export const deliveredList = (entries: readonly PlanEntry[], log: readonly CommitRef[]): string =>
  entries
    .map((entry, i) => {
      const commit = commitOf(entry, log);

      return `${i + 1}. ${entry.goal}${commit === undefined ? '' : ` ${commit.sha.slice(0, 7)}`}`;
    })
    .join('\n');

export const onRemoteOf = (entries: readonly PlanEntry[], log: readonly CommitRef[], remoteShas: readonly string[]): string[] =>
  entries.filter((entry) => remoteShas.includes(commitOf(entry, log)?.sha ?? '')).map((entry) => entry.number);

export const remoteStatus = (landed: readonly string[], onRemote: readonly string[]): string => {
  const list = (items: string[]): string => (items.length === 0 ? 'none' : items.join(', '));

  return `on the remote: ${list(landed.filter((n) => onRemote.includes(n)))}; local only: ${list(landed.filter((n) => !onRemote.includes(n)))}`;
};

export const pauseLine = (reason: string, landed: readonly string[], onRemote: readonly string[]): string =>
  `publication refused, the run is paused here: ${reason.trim().replace(/\s+/g, ' ')} ${remoteStatus(landed, onRemote)}`;

export const prIsReady = (status: number | null, stdout: string): boolean => {
  try {
    const parsed = JSON.parse(stdout) as { state?: unknown; isDraft?: unknown };

    return (status ?? 1) === 0 && parsed.state === 'OPEN' && parsed.isDraft === false;
  } catch {
    return false;
  }
};

export const prDecision = (status: number | null, stdout: string): PrDecision => {
  try {
    const parsed = JSON.parse(stdout) as { number?: unknown; state?: unknown };

    if ((status ?? 1) !== 0 || typeof parsed.number !== 'number') {
      return { kind: 'create' };
    }

    if (parsed.state === 'OPEN') {
      return { kind: 'edit' };
    }

    return {
      kind: 'pause',
      reason: `the branch's pull request #${parsed.number} is ${String(parsed.state)}, and a second one is never opened. Nothing was pushed.`,
    };
  } catch {
    return { kind: 'create' };
  }
};
