import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type InstallResult = {
  readonly ok: boolean;
  readonly skillName: string;
  readonly sandboxRoot: string;
  readonly installedDir: string;
  readonly missingFiles: readonly string[];
  readonly lockEntryFound: boolean;
};

const listFilesRecursive = (dir: string, base = dir): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);

    return statSync(fullPath).isDirectory()
      ? listFilesRecursive(fullPath, base)
      : [relative(base, fullPath)];
  });

export const installSandboxed = async (skillDir: string, skillName: string): Promise<InstallResult> => {
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
    await execFileAsync('npx', ['--yes', 'skills', 'add', resolve(skillDir), '--skill', skillName, '--agent', 'claude-code', '--yes'], {
      cwd: project,
      env: {
        ...process.env,
        HOME: home,
        CLAUDE_CONFIG_DIR: claudeConfigDir,
        CODEX_HOME: codexHome,
        XDG_CONFIG_HOME: xdgConfigHome,
      },
    });

    const installedDir = join(project, '.claude', 'skills', skillName);
    const sourceFiles = listFilesRecursive(skillDir);
    const missingFiles = sourceFiles.filter((file) => !existsSync(join(installedDir, file)));

    const lockPath = join(project, 'skills-lock.json');
    const lockEntryFound = existsSync(lockPath) && skillName in (JSON.parse(readFileSync(lockPath, 'utf8')) as { skills: Record<string, unknown> }).skills;

    return {
      ok: missingFiles.length === 0 && lockEntryFound,
      skillName,
      sandboxRoot,
      installedDir,
      missingFiles,
      lockEntryFound,
    };
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
};
