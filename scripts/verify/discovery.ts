import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

import { PINNED_SKILLS_CLI } from '../../plugins/skills/src/install.ts';
import { listSkills } from '../../plugins/skills/src/repo-coherence.ts';

const FOUND = /Found (\d+) skills?\b/;

const discover = (root: string, cli: string): number => {
  const stock = listSkills(root).length;
  const listed = spawnSync('npx', ['--yes', cli, 'add', '.', '--list'], { cwd: root, encoding: 'utf8' });
  const output = stripVTControlCharacters(`${listed.stdout}${listed.stderr}`);
  const found = FOUND.exec(output)?.[1];

  if (listed.status !== 0 || found === undefined) {
    process.stdout.write(`${output.trimEnd()}\n${cli} reported no skill count (exit status ${String(listed.status)})\n`);

    return 1;
  }

  process.stdout.write(`${cli} discovers ${found} skill(s), the stock lists ${stock}\n`);

  return Number(found) === stock && stock > 0 ? 0 : 1;
};

const args = process.argv.slice(2);
const cliAt = args.indexOf('--cli');
const cli = cliAt === -1 ? PINNED_SKILLS_CLI : args[cliAt + 1];

if (cli === undefined || cli === '') {
  process.stderr.write('usage: discovery.ts [--cli <npm spec>]\n');
  process.exitCode = 2;
} else {
  process.exitCode = discover(process.cwd(), cli);
}
