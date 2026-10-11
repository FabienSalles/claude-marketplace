import type { FailureClass } from '../../ports.ts';

type Terminal = { status: number | null; signal?: NodeJS.Signals | null; stdout: string; stderr: string };

type Event = { type?: string; exitCode?: number; data?: { message?: string } };

const POLICY: readonly { class: 'exhausted' | 'burst'; pattern: RegExp }[] = [
  { class: 'exhausted', pattern: /quota|premium request|out of (?:credits|requests)|402/i },
  { class: 'burst', pattern: /\b429\b|rate.?limit|too many requests/i },
];

const eventsOf = (stdout: string): Event[] =>
  stdout.split('\n').flatMap((line) => {
    try {
      const event: unknown = JSON.parse(line);

      return typeof event === 'object' && event !== null ? [event as Event] : [];
    } catch {
      return [];
    }
  });

export const classifyTerminal = (end: Terminal): { failed: boolean; class: FailureClass; quote: string } => {
  const events = eventsOf(end.stdout);
  const result = events.filter((event) => event.type === 'result').pop();
  const failed = end.status !== 0 || (result?.exitCode !== undefined && result.exitCode !== 0);

  if (!failed) return { failed, class: 'success', quote: '' };

  const message = events.filter((event) => event.type === 'session.error').pop()?.data?.message;
  const quote = [message, end.stderr.trim()].filter((part) => part !== undefined && part !== '').join(' | ');

  if (end.status === 143 || (end.signal !== undefined && end.signal !== null)) return { failed, class: 'signal', quote };

  return { failed, class: POLICY.find((rule) => rule.pattern.test(quote))?.class ?? 'unrecognised', quote };
};
