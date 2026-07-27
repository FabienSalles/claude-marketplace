// Proving tracks independent before a single worktree exists.

import { halt } from './halt.ts';
import { blockOf, covers, declaredPaths } from './plan.ts';

export type Track = {
  name: string;
  suffix: string;
  prepare: string;
  teardown: string;
  iterations: string[];
};

export const trackField = (section: string[], key: string): string => {
  const pattern = new RegExp(`^[-*\\s]*(?:\\*\\*)?${key}:(?:\\*\\*)?\\s*(.*)$`);

  for (const line of section) {
    const found = pattern.exec(line);

    if (found !== null) {
      return (found[1] ?? '').trim().replace(/^`+|`+$/g, '').trim();
    }
  }

  return '';
};

export const trackList = (source: string): Track[] => {
  const lines = source.split('\n');
  const tracks: Track[] = [];

  for (const [index, line] of lines.entries()) {
    const heading = /^## Track\s+(.+?)\s*$/.exec(line);

    if (heading === null) {
      continue;
    }

    const rest = lines.slice(index + 1);
    const next = rest.findIndex((entry) => /^## /.test(entry));
    const section = next === -1 ? rest : rest.slice(0, next);

    tracks.push({
      name: heading[1]!,
      suffix: trackField(section, 'Branch suffix'),
      prepare: trackField(section, 'Prepare'),
      teardown: trackField(section, 'Teardown'),
      iterations: section.flatMap((entry) => {
        const number = /^### Iteration ([0-9]+)\b/.exec(entry);

        return number === null ? [] : [number[1]!];
      }),
    });
  }

  return tracks;
};

export const overlap = (one: string[], other: string[]): string[] =>
  one.filter((entry) => other.some((path) => covers(entry, path) || covers(path, entry)));

// Independence is proven before a single worktree exists: a false track means two pull requests
// that conflict at merge, and discovering it then costs both.
export const tracksCheck = (source: string): void => {
  const tracks = trackList(source);

  if (tracks.length === 0) {
    process.stdout.write('OK: the plan declares no track, so its iterations run as one sequence.\n');

    return;
  }

  for (const track of tracks) {
    if (track.suffix === '') {
      halt(
        `Track ${track.name} declares no branch suffix.`,
        'Every track needs a "Branch suffix:" line: it is what names the branch and the worktree. Without it two tracks would fight over one branch, so nothing is created.',
      );
    }

    if (!/^[a-z0-9._-]+$/.test(track.suffix)) {
      halt(
        `Track ${track.name} declares an unusable branch suffix: ${track.suffix}`,
        'The suffix names a git branch and a worktree directory, and it reaches the shell that creates them, so anything outside [a-z0-9._-] is refused rather than interpolated. A markdown code span around it is stripped; write the rest bare.',
      );
    }

    if (track.iterations.length === 0) {
      halt(
        `Track ${track.name} declares no iteration.`,
        'A track with nothing to run would create a worktree and a branch for no work at all.',
      );
    }
  }

  const suffixes = tracks.map((track) => track.suffix);
  const collision = suffixes.filter((suffix, index) => suffixes.indexOf(suffix) !== index);

  if (collision.length > 0) {
    halt(
      'Two tracks declare the same branch suffix.',
      `Duplicated: ${[...new Set(collision)].join(' ')}\n\nThe suffix names both the branch and the worktree, so two tracks sharing one would commit into the same branch and each would judge the other's code. Give them distinct suffixes.`,
    );
  }

  const seen = new Map<string, string>();

  for (const track of tracks) {
    for (const iteration of track.iterations) {
      const owner = seen.get(iteration);

      if (owner !== undefined) {
        halt(
          `Iteration ${iteration} is declared by two tracks.`,
          `Tracks: ${owner} and ${track.name}\n\nIteration numbers are global to the plan: the gate resolves "### Iteration ${iteration}" by number, so two tracks carrying the same number would both be judged against the first one's block. Renumber them.`,
        );
      }

      seen.set(iteration, track.name);
    }
  }

  const declared = tracks.map((track) => ({
    track,
    paths: track.iterations.flatMap((iteration) => declaredPaths(blockOf(source, iteration))),
  }));

  for (const [index, one] of declared.entries()) {
    for (const other of declared.slice(index + 1)) {
      const shared = overlap(one.paths, other.paths);

      if (shared.length > 0) {
        halt(
          `Tracks ${one.track.name} and ${other.track.name} are not independent.`,
          `Shared: ${shared.join(' ')}\n\nOne file declared by two tracks and the two branches conflict at merge, however green both ran. Move the shared work into a sequential iteration before the tracks, or merge the tracks. Nothing was created.`,
        );
      }
    }
  }

  for (const { track } of declared) {
    process.stdout.write(
      `track\t${track.suffix}\t${track.name}\t${track.iterations.join(' ')}\t${track.prepare}\t${track.teardown}\n`,
    );
  }
};
