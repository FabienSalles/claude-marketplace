import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const restore = (): void => {
  spawnSync('git', ['checkout', '-q', '--', 'tracked']);
};

if (process.env['FIXTURE_MUTATE'] === '1') {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      restore();
      process.exit(143);
    });
  }
  writeFileSync('tracked', 'mutated\n');
  process.stdout.write('ready\n');
  setTimeout(restore, 30_000);
} else {
  process.exitCode = spawnSync('bash', ['-c', process.env['FIXTURE_SCRIPT'] ?? 'echo ran'], { stdio: 'inherit' }).status ?? 1;
}
