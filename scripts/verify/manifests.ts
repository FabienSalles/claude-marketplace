import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG = join('.claude-plugin', 'marketplace.json');

type Json = Record<string, unknown>;

const read = (path: string): Json | undefined => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

    return typeof parsed === 'object' && parsed !== null ? (parsed as Json) : undefined;
  } catch {
    return undefined;
  }
};

const entries = (root: string): readonly Json[] => {
  const plugins = read(join(root, CATALOG))?.['plugins'];

  return Array.isArray(plugins) ? (plugins as Json[]) : [];
};

export const pluginNames = (root: string): readonly string[] => {
  const base = join(root, 'plugins');

  return existsSync(base)
    ? readdirSync(base).filter((name) => statSync(join(base, name)).isDirectory()).sort()
    : [];
};

const manifestPath = (root: string, name: string): string => join(root, 'plugins', name, '.claude-plugin', 'plugin.json');

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export const catalogValid = (root: string): readonly string[] =>
  read(join(root, CATALOG)) === undefined ? [`Invalid or missing JSON: ${CATALOG}`] : [];

export const pluginManifests = (root: string): readonly string[] =>
  pluginNames(root).flatMap((name) => {
    const path = manifestPath(root, name);

    if (!existsSync(path)) {
      return [`Missing: ${path}`];
    }

    return read(path) === undefined ? [`Invalid JSON: ${path}`] : [];
  });

export const catalogParity = (root: string): readonly string[] =>
  pluginNames(root).flatMap((name) => {
    const manifest = read(manifestPath(root, name));

    if (manifest === undefined) {
      return [];
    }

    const catalog = entries(root).find((entry) => entry['name'] === name);

    return ['name', 'version', 'description'].flatMap((field) =>
      text(catalog?.[field]) === text(manifest[field])
        ? []
        : [`${name} — ${field} disagrees: marketplace.json='${text(catalog?.[field])}' vs plugin.json='${text(manifest[field])}'`],
    );
  });

export const catalogSources = (root: string): readonly string[] =>
  entries(root).flatMap((entry) => {
    const source = entry['source'];

    if (typeof source !== 'string') {
      return [];
    }

    const path = join(root, source);

    return existsSync(path) && statSync(path).isDirectory() ? [] : [`marketplace.json references non-existent: ${source}`];
  });
