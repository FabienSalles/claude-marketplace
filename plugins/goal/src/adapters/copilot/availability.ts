import { command } from '../command.ts';

const PROBE = ['-p', 'Reply with the single word OK.', '--output-format', 'json', '--no-auto-update', '--no-ask-user', '--allow-all-tools', '--deny-tool', 'shell', '--deny-tool', 'write'];

export const copilotRefusal = (): string | undefined => {
  const probe = command.run('copilot', PROBE, { env: { ...process.env } });

  if ((probe.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return 'Copilot CLI is not installed (no `copilot` on PATH)';

  const results = probe.stdout.split('\n').flatMap((line) => {
    try {
      const event = JSON.parse(line) as { type?: string; exitCode?: number };

      return event.type === 'result' ? [event] : [];
    } catch {
      return [];
    }
  });

  if (probe.status === 0 && results.length > 0 && results[results.length - 1]?.exitCode === 0) return undefined;

  const quoted = probe.stderr.trim();

  return `Copilot CLI is installed but cannot run a session (not authenticated?)${quoted === '' ? '' : `: ${quoted}`}`;
};
