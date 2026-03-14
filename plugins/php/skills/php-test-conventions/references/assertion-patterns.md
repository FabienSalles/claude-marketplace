# Assertion Patterns

## assertEquals with Expected Object

**IMPORTANT**: Use `assertEquals` with a complete expected object rather than multiple property assertions.

**Why?**
- **Maintainability**: One assertion instead of many
- **Clarity**: The expected result is explicit and complete
- **Diff**: PHPUnit shows a clear diff when objects differ

```php
// ❌ Avoid - Multiple property assertions
$result = $service->getUser();

self::assertInstanceOf(User::class, $result);
self::assertSame('123', $result->getId());
self::assertSame('John', $result->getFirstName());
self::assertSame('Doe', $result->getLastName());
self::assertSame('john@example.com', $result->getEmail());

// ✅ Prefer - Single assertEquals with expected object
$expected = new User();
$expected->setId('123');
$expected->setFirstName('John');
$expected->setLastName('Doe');
$expected->setEmail('john@example.com');

self::assertEquals($expected, $service->getUser());
```

## Asserting Computed Properties

When an object computes properties in its constructor (e.g. age from birthDate, income from raw data), **never reconstruct the object in assertions** — this re-executes the constructor logic, so the test verifies nothing.

Instead, use `assertSame` with a key/value array of **final computed values**:

```php
// ❌ Avoid - Reconstructing the object re-executes constructor logic, testing nothing
self::assertEquals(
    [new OrderSummary('order-uuid', 'buyer-uuid', 1, $now, $birthDate, null, null)],
    $result,
);

// ✅ Correct - Assert final values with permissive access
$orderSummary = $result[0] ?? null;

self::assertSame([
    'orderUuid' => 'order-uuid',
    'buyerUuid' => 'buyer-uuid',
    'buyerAge' => 35,
    'shippingCost' => null,
], [
    'orderUuid' => $orderSummary?->orderUuid,
    'buyerUuid' => $orderSummary?->buyerUuid,
    'buyerAge' => $orderSummary?->buyerAge,
    'shippingCost' => $orderSummary?->shippingCost,
]);
```

**Why?** If the constructor computes `buyerAge = birthDate->diff(now)->y`, reconstructing the object runs the same calculation — a bug in the constructor would pass the test. Asserting `35` directly catches the bug.

## Avoid Guard Assertions

**Never use guard assertions** like `assertCount`, `assertInstanceOf`, `assertNotNull` before the real assertion. They reduce visibility on the actual result when the test fails.

Instead, let the main assertion fail naturally — the diff will show the full context:

```php
// ❌ Avoid - Guard assertions hide the real result on failure
$result = iterator_to_array($resolver->resolve($request, $argument));

self::assertCount(1, $result);           // Fails here → you don't see what $result contains
self::assertInstanceOf(Foo::class, $result[0]);  // Redundant if next assertion checks properties
self::assertNotNull($result[0]->value);  // Crashes if $result is empty

// ✅ Correct - Permissive access with nullsafe, single assertion with full visibility
$result = iterator_to_array($resolver->resolve($request, $argument));
$orderSummary = $result[0] ?? null;

self::assertSame([
    'orderUuid' => 'order-uuid',
    'buyerAge' => 35,
    'shippingCost' => null,
], [
    'orderUuid' => $orderSummary?->orderUuid,
    'buyerAge' => $orderSummary?->buyerAge,
    'shippingCost' => $orderSummary?->shippingCost,
]);
```

**Why?** When a guard assertion fails (`assertCount` expected 1 but got 0), you only see the count mismatch — not *what* the result actually contains. Using `$result[0] ?? null` and `?->` ensures the test never crashes on missing data — instead it shows `null` in the diff, making the problem immediately visible.
