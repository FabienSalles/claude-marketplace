import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { before, describe, it, mock, test } from 'node:test';

type Result = { tag: 'success'; value: number } | { tag: 'failure'; reason: string };

const parse = (raw: string): Result => {
  const value = Number(raw);

  return Number.isNaN(value) ? { tag: 'failure', reason: 'not a number' } : { tag: 'success', value };
};

const double = (n: number): number => n * 2;

const requirePositive = (n: number): number => {
  if (n < 0) {
    throw new RangeError('negative amount');
  }

  return n;
};

const requirePositiveLater = async (n: number): Promise<number> => requirePositive(n);

test('a standalone test', () => {
  assert.strictEqual(double(2), 4);
});

describe('parse', () => {
  it('returns the payload of a success', () => {
    const result = parse('42');

    assert.ok(result.tag === 'success');
    assert.strictEqual(result.value, 42);
  });

  it('builds a structured failure', () => {
    assert.deepStrictEqual(parse('abc'), { tag: 'failure', reason: 'not a number' });
  });
});

const cases = [
  { input: 1, expected: 2 },
  { input: 2, expected: 4 },
];

describe('double', () => {
  for (const { input, expected } of cases) {
    it(`doubles ${String(input)} into ${String(expected)}`, () => {
      assert.strictEqual(double(input), expected);
    });
  }
});

describe('exceptions name the error they expect', () => {
  it('throws', () => {
    assert.throws(() => requirePositive(-1), { name: 'RangeError', message: /negative/ });
  });

  it('rejects', async () => {
    await assert.rejects(requirePositiveLater(-1), { name: 'RangeError', message: /negative/ });
  });
});

describe('mock.fn', () => {
  it('spies on a callback', () => {
    const onDone = mock.fn((value: number) => value);

    [1, 2].forEach(onDone);

    assert.strictEqual(onDone.mock.callCount(), 2);
  });
});

describe('mock.method', () => {
  it('wraps one method of a real object', () => {
    const counter = { next: () => 1 };
    const next = mock.method(counter, 'next', () => 7);

    assert.strictEqual(counter.next(), 7);
    assert.strictEqual(next.mock.callCount(), 1);
    next.mock.restore();
  });
});

describe('mock.timers', () => {
  it('drives a clock that cannot be injected', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fired = mock.fn();

    setTimeout(fired, 1000);
    t.mock.timers.tick(1000);

    assert.strictEqual(fired.mock.callCount(), 1);
  });
});

describe('mock.module', () => {
  it('redirects a singleton that cannot be injected', async () => {
    const mocked = mock.module('node:os', { namedExports: { hostname: () => 'fake-host' } });
    const os = await import('node:os');

    assert.strictEqual(os.hostname(), 'fake-host');
    mocked.restore();
  });
});

const summarize = (id: string, amounts: number[]): string => {
  const total = amounts.length === 0 ? '0' : amounts.reduce((sum, a) => sum + a, 0).toFixed(2);

  return `receipt ${id}: ${String(amounts.length)} lines, total ${total} EUR`;
};

describe('characterization pin', () => {
  it('keeps today\'s summaries, quirk included', () => {
    const frozen = [summarize('R-1', [10, 2.5, 0]), summarize('R-0', [])];

    const golden = readFileSync(new URL('./receipt-summary.golden.txt', import.meta.url), 'utf8');

    assert.strictEqual(`${frozen.join('\n')}\n`, golden);
  });
});

const withDeadline = async <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`no result within ${String(ms)} ms`));
    }, ms);
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

const pendingTimeouts = (): number => process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length;

describe('a deadline leaves nothing behind', () => {
  it('clears its timer once the work wins the race', async () => {
    const pendingBefore = pendingTimeouts();

    const result = await withDeadline(Promise.resolve('summarized'), 30_000);

    assert.strictEqual(result, 'summarized');
    assert.strictEqual(pendingTimeouts(), pendingBefore);
  });
});

const summaryCli = "console.log('3 receipts summarized'); console.error('1 receipt skipped'); process.exitCode = 2";

describe('one spawned run, read by several tests', () => {
  let run: SpawnSyncReturns<string>;

  before(() => {
    run = spawnSync(process.execPath, ['--eval', summaryCli], { encoding: 'utf8', timeout: 10_000 });
  });

  it('exits with the code the program set', () => {
    assert.strictEqual(run.status, 2);
  });

  it('prints its summary on stdout', () => {
    assert.strictEqual(run.stdout, '3 receipts summarized\n');
  });

  it('keeps its warning on stderr', () => {
    assert.strictEqual(run.stderr, '1 receipt skipped\n');
  });
});
