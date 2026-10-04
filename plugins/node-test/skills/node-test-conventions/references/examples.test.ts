import assert from 'node:assert/strict';
import { describe, it, mock, test } from 'node:test';

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
