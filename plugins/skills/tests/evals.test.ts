import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { evalsFindings } from '../src/evals.ts';
import type { SkillRef } from '../src/repo-coherence.ts';

const SKILLS: readonly SkillRef[] = [{ plugin: 'demo', name: 'valid', dir: join(import.meta.dirname, 'fixtures', 'valid') }];

const routingCase = (overrides: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  query: 'Certify my skill',
  skills: ['demo:valid'],
  expected_behavior: ['loads demo:valid'],
  ...overrides,
});

const cases: readonly { readonly rule: string; readonly content: string; readonly failing: readonly string[] }[] = [
  { rule: 'a routing case with a query, a resolving skill and an expected behavior passes', content: JSON.stringify({ routing: [routingCase({})] }), failing: [] },
  { rule: 'a file that is not JSON fails', content: '{ "routing": [', failing: ['evals-routing-shape'] },
  { rule: 'a file with no routing case fails', content: JSON.stringify({ routing: [] }), failing: ['evals-routing-shape'] },
  { rule: 'a routing case with a blank query fails', content: JSON.stringify({ routing: [routingCase({ query: ' ' })] }), failing: ['evals-routing-shape'] },
  { rule: 'a routing case naming no skill fails', content: JSON.stringify({ routing: [routingCase({ skills: [] })] }), failing: ['evals-routing-shape'] },
  { rule: 'a routing case naming a skill outside the marketplace fails', content: JSON.stringify({ routing: [routingCase({ skills: ['demo:other'] })] }), failing: ['evals-skills-exist'] },
  { rule: 'a routing case with no expected behavior fails', content: JSON.stringify({ routing: [routingCase({ expected_behavior: [] })] }), failing: ['evals-routing-shape'] },
];

for (const { rule, content, failing } of cases) {
  test(rule, () => {
    const dir = mkdtempSync(join(tmpdir(), 'skills-evals-'));

    try {
      writeFileSync(join(dir, 'evals.json'), content);

      const findings = evalsFindings(join(dir, 'evals.json'), SKILLS);

      assert.deepEqual(
        findings.filter((finding) => finding.status === 'fail').map((finding) => finding.rule),
        failing,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
