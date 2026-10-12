import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const allowlist: { starts: string; reason: string }[] = [
  { starts: 'When `<root>/src/artifacts.ts`', reason: 'bootstrap stop stays inline in every skill' },
  { starts: '`<root>` is Claude Code', reason: 'bootstrap stays inline in every skill' },
  { starts: '| Step | Implementer |', reason: 'duration table is shared by design' },
];

function files(): string[] {
  const out: string[] = [];
  for (const skill of readdirSync(join(root, 'skills'))) out.push(join('skills', skill, 'SKILL.md'));
  for (const dir of ['agents', 'shared'])
    for (const f of readdirSync(join(root, dir))) if (f.endsWith('.md')) out.push(join(dir, f));
  return out;
}

function paragraphs(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let fenced = false;
  const flush = () => {
    if (current.length >= 3) out.push(current.join('\n'));
    current = [];
  };
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      flush();
    } else if (fenced || line.trim() === '') flush();
    else current.push(line.trimEnd());
  }
  flush();
  return out;
}

// rule: R12 no exact multi-line paragraph appears in two files unless allowlisted
test('no paragraph of 3+ lines is copied across goal skills, agents and shared files', () => {
  const seen = new Map<string, Set<string>>();
  for (const file of files()) {
    for (const p of paragraphs(readFileSync(join(root, file), 'utf8'))) {
      seen.set(p, (seen.get(p) ?? new Set()).add(file));
    }
  }
  const copies = [...seen]
    .filter(([p, set]) => set.size >= 2 && !allowlist.some((a) => p.startsWith(a.starts)))
    .map(([p, set]) => `${[...set].join(', ')}:\n${p}`);
  assert.deepEqual(copies, []);
});

// rule: R1 R2 R3 the handoff routing lives only in shared/handoff.md
test('the handoff routing and clipboard offer are written once, in shared/handoff.md', () => {
  const shared = readFileSync(join(root, 'shared', 'handoff.md'), 'utf8');
  assert.match(shared, /Copy the `\/goal` handoff to the\s+clipboard\?/);
  assert.match(shared, /\| `commit\+pr` \| all gateable \|/);
  for (const skill of ['plan', 'next']) {
    const text = readFileSync(join(root, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.match(text, /<root>\/shared\/handoff\.md/, skill);
    assert.doesNotMatch(text, /Copy the `\/goal` handoff to the/, skill);
    assert.doesNotMatch(text, /\| `commit\+pr` \| all gateable \|/, skill);
  }
});

const families: { name: string; file: string; marker: RegExp; skills: string[] }[] = [
  { name: 'portability', file: 'portability.md', marker: /No `AskUserQuestion` tool/, skills: ['plan', 'spec', 'tickets', 'next'] },
  { name: 'grill approach', file: 'grill-approach.md', marker: /pocock:grill-with-docs/, skills: ['plan', 'spec'] },
  { name: 'jira source', file: 'jira-source.md', marker: /getAccessibleAtlassianResources/, skills: ['plan', 'spec'] },
  { name: 'plan argument', file: 'plan-argument.md', marker: /Never substitute a plan from another directory/, skills: ['next', 'supervise'] },
];

for (const { name, file, marker, skills } of families) {
  // rule: R2 R3 R10 the family marker lives only in its shared file and each reader names it
  test(`the ${name} rule is written once, in shared/${file}`, () => {
    assert.match(readFileSync(join(root, 'shared', file), 'utf8'), marker);
    for (const skill of readdirSync(join(root, 'skills'))) {
      if (skill === 'grill-adversarial') continue;
      const text = readFileSync(join(root, 'skills', skill, 'SKILL.md'), 'utf8');
      assert.doesNotMatch(text, marker, skill);
      if (skills.includes(skill)) assert.match(text, new RegExp(`<root>/shared/${file.replace('.', '\\.')}`), skill);
    }
  });
}
