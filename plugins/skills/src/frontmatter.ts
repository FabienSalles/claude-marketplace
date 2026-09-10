import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export type Frontmatter = {
  readonly fields: Readonly<Record<string, unknown>>;
};

export type FrontmatterResult =
  | { readonly ok: true; readonly skillMdPath: string; readonly frontmatter: Frontmatter }
  | { readonly ok: false; readonly skillMdPath: string; readonly reason: string };

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

export const readFrontmatter = (skillDir: string): FrontmatterResult => {
  const skillMdPath = join(skillDir, 'SKILL.md');
  let content: string;

  try {
    content = readFileSync(skillMdPath, 'utf8');
  } catch {
    return { ok: false, skillMdPath, reason: `cannot read ${skillMdPath}` };
  }

  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    return { ok: false, skillMdPath, reason: `${skillMdPath} has no YAML frontmatter block` };
  }

  const raw = match[1] ?? '';
  let fields: Record<string, unknown>;

  try {
    const parsed: unknown = parse(raw);
    fields = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    return { ok: false, skillMdPath, reason: `${skillMdPath} frontmatter is not valid YAML: ${(error as Error).message}` };
  }

  return { ok: true, skillMdPath, frontmatter: { fields } };
};
