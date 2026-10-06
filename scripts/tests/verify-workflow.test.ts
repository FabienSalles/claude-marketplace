import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { parse, stringify } from 'yaml';

import { CHECKS } from '../verify/checks.ts';
import { forCi } from '../verify/ci.ts';
import { CLAUDE_PIN, workflowFindings, workflowGuard } from '../verify/workflow.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');

const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/validate.yml'), 'utf8');

type Json = Record<string, unknown>;

const record = (value: unknown): Json => {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));

  return value as Json;
};

const steps = (workflow: Json, job: string): Json[] => {
  const list = record(record(workflow['jobs'])[job])['steps'];

  assert.ok(Array.isArray(list));

  return list as Json[];
};

const findingsAfter = (change: (workflow: Json) => void): readonly string[] => {
  const workflow = record(parse(WORKFLOW));

  change(workflow);

  return workflowFindings(stringify(workflow));
};

const job = (workflow: Json, id: string): Json => record(record(workflow['jobs'])[id]);

test('the repository workflow passes its own guard', () => {
  assert.deepEqual(workflowFindings(WORKFLOW), []);
});

test('a raw check step is refused, named with its job', () => {
  const findings = findingsAfter((workflow) => {
    steps(workflow, 'unit').splice(2, 0, { name: 'Sneaky check', run: 'jq empty a.json' });
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0] ?? '', /job unit, step "Sneaky check": not a setup step nor the entry/);
});

test('an unnamed raw step is named by its command', () => {
  assert.match(findingsAfter((workflow) => steps(workflow, 'unit').push({ run: './scripts/x.sh' })).join('\n'), /x\.sh/);
});

test('an entry naming an unknown group is refused', () => {
  const findings = findingsAfter((workflow) => {
    const entry = steps(workflow, 'unit').find((step) => step['run'] === 'node scripts/verify.ts unit');

    assert.ok(entry !== undefined);
    entry['run'] = 'node scripts/verify.ts nonsense';
  });

  assert.match(findings.join('\n'), /unknown group nonsense/);
});

test('an entry through npm is refused, so that no npm setting can change what a job runs', () => {
  const findings = findingsAfter((workflow) => {
    const entry = steps(workflow, 'unit').find((step) => step['run'] === 'node scripts/verify.ts unit');

    assert.ok(entry !== undefined);
    entry['run'] = 'npm run verify -- unit';
  }).join('\n');

  assert.match(findings, /job unit, step "Run the checks": not a setup step nor the entry/);
  assert.match(findings, /group unit is named by 0 pull-request job entries instead of one/);
});

const setupNode = (workflow: Json, id: string): Json => {
  const found = steps(workflow, id).find((step) => String(step['uses']).startsWith('actions/setup-node@'));

  assert.ok(found !== undefined);

  return found;
};

test('a pull-request job reads its Node from .nvmrc and from nothing else', () => {
  for (const inputs of [{ 'node-version': '24' }, { 'node-version': '24.16.0' }, { 'node-version-file': 'package.json' }, { 'node-version-file': '.nvmrc', 'node-version': '24' }]) {
    assert.deepEqual(
      findingsAfter((workflow) => {
        setupNode(workflow, 'unit')['with'] = inputs;
      }),
      ['.github/workflows/validate.yml: job unit, step "Setup Node.js": setup-node in a pull-request job must read node-version-file: .nvmrc'],
      JSON.stringify(inputs),
    );
  }
});

test("the canary job floats on node-version: '24' and on nothing else", () => {
  for (const inputs of [{ 'node-version-file': '.nvmrc' }, { 'node-version': '20' }, { 'node-version': 'latest' }, { 'node-version': 24 }]) {
    assert.deepEqual(
      findingsAfter((workflow) => {
        setupNode(workflow, 'canary')['with'] = inputs;
      }),
      [".github/workflows/validate.yml: job canary, step \"Setup Node.js\": setup-node in the canary job must float on node-version: '24'"],
      JSON.stringify(inputs),
    );
  }
});

test('every job sets up Node exactly once', () => {
  assert.deepEqual(
    findingsAfter((workflow) => {
      job(workflow, 'unit')['steps'] = steps(workflow, 'unit').filter((step) => !String(step['uses']).startsWith('actions/setup-node@'));
    }),
    ['.github/workflows/validate.yml: job unit sets up Node 0 times instead of once'],
  );
  assert.match(
    findingsAfter((workflow) => steps(workflow, 'canary').unshift(structuredClone(setupNode(workflow, 'canary')))).join('\n'),
    /job canary sets up Node 2 times instead of once/,
  );
});

test('.nvmrc holds one exact Node 24 version', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'verify-workflow-'));

  try {
    mkdirSync(join(sandbox, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(sandbox, '.github', 'workflows', 'validate.yml'), WORKFLOW);
    assert.deepEqual(workflowGuard(sandbox), ['.nvmrc must hold one exact Node 24 version, x.y.z']);

    for (const [text, findings] of [
      ['24.16.0\n', 0],
      ['24\n', 1],
      ['lts/*\n', 1],
      ['22.11.0\n', 1],
      ['24.16.0\n24.17.0\n', 1],
    ] as const) {
      writeFileSync(join(sandbox, '.nvmrc'), text);
      assert.equal(workflowGuard(sandbox).length, findings, text);
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('the repository pins the Node it was developed on', () => {
  assert.equal(readFileSync(resolve(ROOT, '.nvmrc'), 'utf8'), '24.16.0\n');
});

test('an action outside the allowlist is refused, and setup-uv runs only in the canary job', () => {
  assert.match(findingsAfter((workflow) => steps(workflow, 'unit').unshift({ uses: 'dorny/paths-filter@v3' })).join('\n'), /not an allowed setup action/);
  assert.match(findingsAfter((workflow) => steps(workflow, 'unit').unshift({ uses: 'astral-sh/setup-uv@v5' })).join('\n'), /setup-uv runs only in the canary job/);
});

test('checkout takes no input', () => {
  const findings = findingsAfter((workflow) => {
    const [checkout] = steps(workflow, 'unit');

    assert.ok(checkout !== undefined);
    checkout['with'] = { 'fetch-depth': 0 };
  });

  assert.match(findings.join('\n'), /checkout takes no input/);
});

const PINNED_INSTALL = `npm install -g @anthropic-ai/claude-code@${CLAUDE_PIN}`;

const LATEST_INSTALL = 'npm install -g @anthropic-ai/claude-code';

const install = (workflow: Json, id: string): Json => {
  const found = steps(workflow, id).find((step) => String(step['run']).startsWith('npm install -g'));

  assert.ok(found !== undefined);

  return found;
};

test('plugin-validate installs the pinned Claude Code and the canary the latest, each exactly once', () => {
  assert.equal(CLAUDE_PIN, '2.1.285');
  assert.equal(install(record(parse(WORKFLOW)), 'plugin-validate')['run'], PINNED_INSTALL);
  assert.equal(install(record(parse(WORKFLOW)), 'canary')['run'], LATEST_INSTALL);
  assert.match(
    findingsAfter((workflow) => {
      job(workflow, 'plugin-validate')['steps'] = steps(workflow, 'plugin-validate').filter((step) => step['run'] !== PINNED_INSTALL);
    }).join('\n'),
    new RegExp(`job plugin-validate must install Claude Code with "npm install -g @anthropic-ai/claude-code@${CLAUDE_PIN.replaceAll('.', '\\.')}" exactly once`),
  );
  assert.match(
    findingsAfter((workflow) => {
      job(workflow, 'canary')['steps'] = steps(workflow, 'canary').filter((step) => step['run'] !== LATEST_INSTALL);
    }).join('\n'),
    /job canary must install Claude Code with "npm install -g @anthropic-ai\/claude-code" exactly once/,
  );
  assert.match(
    findingsAfter((workflow) => steps(workflow, 'plugin-validate').unshift({ run: PINNED_INSTALL })).join('\n'),
    /job plugin-validate must install Claude Code with .* exactly once/,
  );
});

test('the pinned Claude Code install runs only in the plugin-validate job, the latest only in the canary job', () => {
  assert.match(
    findingsAfter((workflow) => steps(workflow, 'unit').unshift({ run: LATEST_INSTALL })).join('\n'),
    /job unit, step "npm install -g @anthropic-ai\/claude-code": the latest Claude Code install runs only in the canary job/,
  );
  assert.match(
    findingsAfter((workflow) => steps(workflow, 'unit').unshift({ run: PINNED_INSTALL })).join('\n'),
    /job unit, step "npm install -g @anthropic-ai\/claude-code@[\d.]+": the pinned Claude Code install runs only in the plugin-validate job/,
  );
  assert.match(
    findingsAfter((workflow) => {
      install(workflow, 'plugin-validate')['run'] = LATEST_INSTALL;
    }).join('\n'),
    /job plugin-validate, step "Install Claude Code": the latest Claude Code install runs only in the canary job/,
  );
  assert.match(
    findingsAfter((workflow) => {
      install(workflow, 'canary')['run'] = PINNED_INSTALL;
    }).join('\n'),
    /job canary, step "Install Claude Code": the pinned Claude Code install runs only in the plugin-validate job/,
  );
});

test('any other spelling of the Claude Code install is refused', () => {
  for (const command of [
    'npm install -g @anthropic-ai/claude-code@latest',
    'npm install -g @anthropic-ai/claude-code@2',
    'npm install -g @anthropic-ai/claude-code@^2.1.285',
    'npm i -g @anthropic-ai/claude-code',
    `npm install -g @anthropic-ai/claude-code@${CLAUDE_PIN} && true`,
  ]) {
    for (const id of ['plugin-validate', 'canary']) {
      assert.match(
        findingsAfter((workflow) => {
          install(workflow, id)['run'] = command;
        }).join('\n'),
        new RegExp(`job ${id}, step "Install Claude Code": not a setup step nor the entry`),
        `${id}: ${command}`,
      );
    }
  }
});

test('a job without the entry, or with it twice, is refused', () => {
  assert.match(
    findingsAfter((workflow) => {
      job(workflow, 'unit')['steps'] = steps(workflow, 'unit').slice(0, 2);
    }).join('\n'),
    /job unit runs the entry 0 times instead of once/,
  );
  assert.match(
    findingsAfter((workflow) => steps(workflow, 'unit').push({ run: 'node scripts/verify.ts structure' })).join('\n'),
    /job unit runs the entry 2 times instead of once/,
  );
});

test('a job without timeout-minutes is refused', () => {
  assert.deepEqual(
    findingsAfter((workflow) => {
      delete job(workflow, 'unit')['timeout-minutes'];
    }),
    ['.github/workflows/validate.yml: job unit declares no timeout-minutes'],
  );
});

test('a job may not give itself more than fifteen minutes', () => {
  assert.deepEqual(
    findingsAfter((workflow) => {
      job(workflow, 'unit')['timeout-minutes'] = 360;
    }),
    ['.github/workflows/validate.yml: job unit sets timeout-minutes to 360, above the 15-minute cap'],
  );
});

test('pull-request jobs run on the pinned ubuntu, the shell suites also on a pinned macOS, the canary on the latest ubuntu', () => {
  const runnerFindings = (change: (workflow: Json) => void): string => findingsAfter(change).join('\n');

  assert.match(
    runnerFindings((workflow) => {
      job(workflow, 'unit')['runs-on'] = 'ubuntu-latest';
    }),
    /job unit must run on ubuntu-24\.04 with no strategy/,
  );
  assert.match(
    runnerFindings((workflow) => {
      record(record(job(workflow, 'shell-suites')['strategy'])['matrix'])['os'] = ['ubuntu-24.04'];
    }),
    /job shell-suites must run on \$\{\{ matrix\.os \}\} over fail-fast: false and os: \[ubuntu-24\.04, macos-<version>\]/,
  );
  assert.match(
    runnerFindings((workflow) => {
      record(record(job(workflow, 'shell-suites')['strategy'])['matrix'])['os'] = ['ubuntu-24.04', 'macos-latest'];
    }),
    /job shell-suites must run on/,
  );
  assert.match(
    runnerFindings((workflow) => {
      record(job(workflow, 'shell-suites')['strategy'])['fail-fast'] = true;
    }),
    /job shell-suites must run on/,
  );
  assert.match(
    runnerFindings((workflow) => {
      job(workflow, 'mutation')['strategy'] = structuredClone(job(workflow, 'shell-suites')['strategy']);
    }),
    /job mutation must run on ubuntu-24\.04 with no strategy/,
  );
  assert.match(
    runnerFindings((workflow) => {
      job(workflow, 'canary')['runs-on'] = 'ubuntu-24.04';
    }),
    /job canary must run on ubuntu-latest with no strategy/,
  );
});

test('the concurrency group is kept verbatim, so that only a superseded pull-request run is cancelled', () => {
  assert.match(
    findingsAfter((workflow) => {
      workflow['concurrency'] = { group: 'one', 'cancel-in-progress': true };
    }).join('\n'),
    /concurrency must be exactly/,
  );
  assert.match(
    findingsAfter((workflow) => {
      delete workflow['concurrency'];
    }).join('\n'),
    /concurrency must be exactly/,
  );
});

test('every key that could neutralise a check is refused, at every level', () => {
  const neutralisers: readonly ((workflow: Json) => void)[] = [
    (workflow) => {
      workflow['env'] = { npm_config_script_shell: '/usr/bin/true' };
    },
    (workflow) => {
      workflow['defaults'] = { run: { shell: 'true {0}' } };
    },
    (workflow) => {
      job(workflow, 'unit')['if'] = false;
    },
    (workflow) => {
      job(workflow, 'unit')['continue-on-error'] = true;
    },
    (workflow) => {
      job(workflow, 'unit')['env'] = { npm_config_script_shell: '/usr/bin/true' };
    },
    (workflow) => {
      job(workflow, 'unit')['defaults'] = { run: { shell: 'true {0}' } };
    },
    (workflow) => {
      for (const step of steps(workflow, 'unit')) {
        step['continue-on-error'] = true;
      }
    },
    (workflow) => {
      for (const step of steps(workflow, 'unit')) {
        step['if'] = false;
      }
    },
    (workflow) => {
      for (const step of steps(workflow, 'unit')) {
        step['shell'] = 'true {0}';
      }
    },
    (workflow) => {
      for (const step of steps(workflow, 'unit')) {
        step['env'] = { npm_config_script_shell: '/usr/bin/true' };
      }
    },
  ];

  for (const neutralise of neutralisers) {
    assert.notDeepEqual(findingsAfter(neutralise), [], neutralise.toString());
  }
});

test('every group but the canary runs in exactly one pull-request job', () => {
  assert.match(
    findingsAfter((workflow) => {
      delete record(workflow['jobs'])['unit'];
    }).join('\n'),
    /group unit is named by 0 pull-request job entries instead of one/,
  );
  assert.match(
    findingsAfter((workflow) => {
      record(workflow['jobs'])['unit-again'] = structuredClone(job(workflow, 'unit'));
    }).join('\n'),
    /group unit is named by 2 pull-request job entries instead of one/,
  );
  assert.match(findingsAfter((workflow) => {
    workflow['jobs'] = {};
  }).join('\n'), /group structure is named by 0/);
});

test('the canary runs only in the schedule-only job, and only on a schedule', () => {
  assert.match(
    findingsAfter((workflow) => {
      const entry = steps(workflow, 'unit').find((step) => step['run'] === 'node scripts/verify.ts unit');

      assert.ok(entry !== undefined);
      entry['run'] = 'node scripts/verify.ts canary';
    }).join('\n'),
    /job unit runs group canary, which belongs to the schedule-only job/,
  );
  assert.match(
    findingsAfter((workflow) => {
      delete job(workflow, 'canary')['if'];
    }).join('\n'),
    /group canary is named by 0 schedule-only job entries instead of one/,
  );
  assert.match(
    findingsAfter((workflow) => {
      delete record(workflow['on'])['schedule'];
    }).join('\n'),
    /never runs on a schedule/,
  );
});

test('a condition on the canary job other than the schedule one is refused', () => {
  for (const condition of ['false', "github.event_name == 'push'", 'always()']) {
    assert.match(
      findingsAfter((workflow) => {
        job(workflow, 'canary')['if'] = condition;
      }).join('\n'),
      /group canary is named by 0 schedule-only job entries instead of one/,
      condition,
    );
  }
});

test('the canary failure step is accepted only verbatim, and only in the canary job', () => {
  const report = (workflow: Json): Json => {
    const found = steps(workflow, 'canary').find((step) => step['if'] === 'failure()');

    assert.ok(found !== undefined);

    return found;
  };

  assert.notDeepEqual(findingsAfter((workflow) => {
    report(workflow)['run'] = `${String(report(workflow)['run'])}node scripts/verify.ts structure\n`;
  }), []);
  assert.notDeepEqual(findingsAfter((workflow) => {
    report(workflow)['continue-on-error'] = true;
  }), []);
  assert.notDeepEqual(findingsAfter((workflow) => steps(workflow, 'unit').push(structuredClone(report(workflow)))), []);
  assert.notDeepEqual(findingsAfter((workflow) => {
    job(workflow, 'canary')['permissions'] = { contents: 'write', issues: 'write' };
  }), []);
});

test('the canary reports its failure with exactly one issue step, after the entry', () => {
  const isReport = (step: Json): boolean => step['if'] === 'failure()';

  assert.match(
    findingsAfter((workflow) => {
      job(workflow, 'canary')['steps'] = steps(workflow, 'canary').filter((step) => !isReport(step));
    }).join('\n'),
    /job canary must end with exactly one canary failure report step/,
  );
  assert.match(
    findingsAfter((workflow) => {
      const report = steps(workflow, 'canary').find(isReport);

      assert.ok(report !== undefined);
      steps(workflow, 'canary').push(structuredClone(report));
    }).join('\n'),
    /job canary must end with exactly one canary failure report step/,
  );
  assert.match(
    findingsAfter((workflow) => {
      const list = steps(workflow, 'canary');
      const report = list.find(isReport);

      assert.ok(report !== undefined);
      job(workflow, 'canary')['steps'] = [report, ...list.filter((step) => !isReport(step))];
    }).join('\n'),
    /job canary must end with exactly one canary failure report step/,
  );
});

test('a workflow that never runs on pull_request is refused', () => {
  assert.match(
    findingsAfter((workflow) => {
      delete record(workflow['on'])['pull_request'];
    }).join('\n'),
    /never runs on pull_request/,
  );
});

test('a trigger filter that could keep pull requests or pushes to main from running CI is refused', () => {
  const filters: readonly [string, unknown][] = [
    ['pull_request', { branches: ['main'], types: ['closed'] }],
    ['pull_request', { branches: ['main'], paths: ['nothing/**'] }],
    ['pull_request', { branches: ['main'], 'paths-ignore': ['**'] }],
    ['pull_request', { branches: ['never-a-branch'] }],
    ['push', { 'branches-ignore': ['main'] }],
    ['push', { branches: ['main'], tags: ['v*'] }],
  ];

  for (const [event, filter] of filters) {
    assert.match(
      findingsAfter((workflow) => {
        record(workflow['on'])[event] = filter;
      }).join('\n'),
      new RegExp(`on\\.${event} must be exactly \\{"branches":\\["main"\\]\\}`),
      JSON.stringify(filter),
    );
  }

  assert.match(
    findingsAfter((workflow) => {
      delete record(workflow['on'])['push'];
    }).join('\n'),
    /never runs on push/,
  );
});

test('only push, pull_request and one schedule may trigger the workflow', () => {
  assert.match(
    findingsAfter((workflow) => {
      record(workflow['on'])['pull_request_target'] = { branches: ['main'] };
    }).join('\n'),
    /triggers on pull_request_target; only push, pull_request and schedule are allowed/,
  );
  assert.match(
    findingsAfter((workflow) => {
      record(workflow['on'])['schedule'] = [{ cron: '23 4 * * *' }, { cron: '41 16 * * *' }];
    }).join('\n'),
    /on\.schedule must be exactly one cron entry/,
  );
  assert.match(
    findingsAfter((workflow) => {
      workflow['on'] = 'pull_request';
    }).join('\n'),
    /must trigger on a map of push, pull_request and schedule/,
  );
});

test('outside CI the goal suite runs without its wall-clock ceiling; on CI every check is unchanged', () => {
  const suite = (checks: typeof CHECKS): string =>
    checks.flatMap((check) => ('command' in check && check.command.some((word) => word.endsWith('budget.ts')) ? [check.command.join(' ')] : [])).join();

  assert.equal(forCi(CHECKS, { GITHUB_ACTIONS: 'true' }), CHECKS);
  assert.match(suite(CHECKS), /--runs 1 --wall \d+$/);
  assert.equal(suite(forCi(CHECKS, {})), 'node plugins/goal/tests/support/budget.ts --runs 1');
  assert.deepEqual(
    forCi(CHECKS, {}).filter((check) => !('command' in check) || !check.command.some((word) => word.endsWith('budget.ts'))),
    CHECKS.filter((check) => !('command' in check) || !check.command.some((word) => word.endsWith('budget.ts'))),
  );
});

test('the docs and the workflow carry no copied ceiling, check list, cron time or second install', () => {
  for (const path of ['.github/workflows/validate.yml', 'plugins/goal/README.md', 'CONTRIBUTING.md', 'docs/install-local-mac.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8');
    assert.doesNotMatch(text, /--wall \d/, path);
    assert.doesNotMatch(text, /deliberately not vendored|validate-skills\.sh|check-doc-counts|are CI concerns|npm install --no-save/, path);
  }

  for (const path of ['CONTRIBUTING.md', 'docs/install-local-mac.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8');
    assert.doesNotMatch(text, /macos-latest|\b\d{1,2}:\d{2} UTC\b/, path);
  }

  const schedule = record(record(parse(WORKFLOW))['on'])['schedule'];

  assert.ok(Array.isArray(schedule));

  const cron = String(record(schedule[0])['cron']);
  const [minute = '', hour = ''] = cron.split(' ');
  const sentences = CHECKS.map((check) => check.name).filter((name) => name.includes(' '));

  for (const path of ['CONTRIBUTING.md', 'docs/install-local-mac.md', 'plugins/goal/README.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8');

    assert.ok(!text.includes(cron), `${path} copies the cron ${cron}`);
    assert.doesNotMatch(text, new RegExp(`\\b0?${hour}:${minute}\\b`), path);
    assert.doesNotMatch(text, /\b\d+ (?:[a-z-]+ )?(?:checks?|tests?|test files?|suites?|groups?|jobs?)\b/, path);

    for (const name of sentences) {
      assert.ok(!text.includes(name), `${path} quotes the check name "${name}"`);
    }
  }
});

test('the checks load before npm ci has installed anything', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'verify-'));

  try {
    const copy = join(sandbox, 'verify');
    cpSync(join(ROOT, 'scripts', 'verify'), copy, { recursive: true });

    const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(join(copy, 'checks.ts'))});`], { encoding: 'utf8' });

    assert.equal(loaded.stderr, '');
    assert.equal(loaded.status, 0);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
