import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import type { SkillRef } from './repo-coherence.ts';

const execFileAsync = promisify(execFile);

export const PINNED_SKILLS_CLI = 'skills@1.7.0';

export type SkillInstall = {
  readonly name: string;
  readonly dir: string;
  readonly missingFiles: readonly string[];
  readonly lockEntryFound: boolean;
};

export type InstallResult = {
  readonly ok: boolean;
  readonly sandboxRoot: string;
  readonly installs: readonly SkillInstall[];
};

const listFilesRecursive = (dir: string, base = dir): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);

    return statSync(fullPath).isDirectory()
      ? listFilesRecursive(fullPath, base)
      : [relative(base, fullPath)];
  });

export const installSandboxed = async (
  source: string,
  skills: readonly Pick<SkillRef, 'name' | 'dir'>[],
  cli: string = PINNED_SKILLS_CLI,
): Promise<InstallResult> => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'skills-install-'));
  const home = join(sandboxRoot, 'home');
  const claudeConfigDir = join(sandboxRoot, 'claude-config');
  const codexHome = join(sandboxRoot, 'codex-home');
  const xdgConfigHome = join(sandboxRoot, 'xdg-config');
  const project = join(sandboxRoot, 'project');

  for (const dir of [home, claudeConfigDir, codexHome, xdgConfigHome, project]) {
    mkdirSync(dir, { recursive: true });
  }

  try {
    await execFileAsync('npx', ['--yes', cli, 'add', resolve(source), '--skill', ...skills.map((skill) => skill.name), '--agent', 'claude-code', '--yes'], {
      cwd: project,
      env: {
        ...process.env,
        HOME: home,
        CLAUDE_CONFIG_DIR: claudeConfigDir,
        CODEX_HOME: codexHome,
        XDG_CONFIG_HOME: xdgConfigHome,
        npm_config_cache: process.env['npm_config_cache'] ?? join(homedir(), '.npm'),
      },
    });

    const lockPath = join(project, 'skills-lock.json');
    const locked = existsSync(lockPath) ? (JSON.parse(readFileSync(lockPath, 'utf8')) as { skills: Record<string, unknown> }).skills : {};
    const installs = skills.map((skill) => {
      const installedDir = join(project, '.claude', 'skills', skill.name);

      return {
        name: skill.name,
        dir: skill.dir,
        missingFiles: listFilesRecursive(skill.dir).filter((file) => !existsSync(join(installedDir, file))),
        lockEntryFound: skill.name in locked,
      };
    });

    return {
      ok: installs.every((install) => install.missingFiles.length === 0 && install.lockEntryFound),
      sandboxRoot,
      installs,
    };
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
};
