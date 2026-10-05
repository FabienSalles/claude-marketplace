export type PrDecision = { kind: 'create' } | { kind: 'edit' } | { kind: 'pause'; reason: string };

export const remoteStatus = (landed: readonly string[], onRemote: readonly string[]): string => {
  const list = (items: string[]): string => (items.length === 0 ? 'none' : items.join(', '));

  return `on the remote: ${list(landed.filter((n) => onRemote.includes(n)))}; local only: ${list(landed.filter((n) => !onRemote.includes(n)))}`;
};

export const pauseLine = (reason: string, landed: readonly string[], onRemote: readonly string[]): string =>
  `publication refused, the run is paused here: ${reason.trim().replace(/\s+/g, ' ')} ${remoteStatus(landed, onRemote)}`;

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
