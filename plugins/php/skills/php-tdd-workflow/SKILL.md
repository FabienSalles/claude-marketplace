---
name: php-tdd-workflow
description: This skill should be used when developing new features, implementing user stories, using "/feature-dev", or when the user mentions "TDD", "test first", "red-green-refactor", or "itérations". Provides the project's TDD workflow and test organization conventions.
version: "1.0"
---

# TDD Workflow

This skill documents the Test-Driven Development workflow for this project.

> **Note**: For test writing conventions (DAMP, test doubles, factories, annotations), see the `php-test-conventions` skill.

## Philosophy

**Test First, Always.** Every feature follows TDD with small iterations:
1. Write ONE failing test (Red)
2. Write minimal code to pass (Green)
3. Refactor if needed
4. Return to entry point (API) for next iteration

## Feature Development Process

### Phase 1: Analysis (Big Picture)

Analyze the complete feature before coding:
- Understand all requirements
- Identify layers involved (API, Domain, SPI)
- Plan test cases
- Identify happy path and edge cases

**Output**: Complete understanding, but implementation is iterative.

### Phase 2: Iterative Implementation

**Key principle**: Small iterations across all layers, not layer-by-layer completion.

```
Iteration 1: Controller stub + first Domain behavior
     ↓
Iteration 2: Domain logic + SPI interface
     ↓
Iteration 3: Back to Controller → complete happy path
     ↓
Iteration 4: Edge case handling
     ↓
...continue until feature complete
```

Each iteration can touch API, Domain, and SPI as needed.

## Iteration Pattern

### Example: "New Discount" feature

**Iteration 1: Controller route exists**
```
Test: Functional → authenticated user gets 200
Implement: Empty controller with route annotation
```

**Iteration 2: Eligibility check in controller**
```
Test: Functional → ineligible user redirected
Implement: Inject specification, add redirect logic
```

**Iteration 3: Specification logic**
```
Test: Unit/Domain → 100% completion returns true
Implement: IsBuyerEligibleForDiscount specification
```

**Iteration 4: Back to controller - wire it up**
```
Test: Functional → verify full flow works
Implement: Connect specification to controller
```

**Iteration 5: Edge case - multiple buyers**
```
Test: Unit/Domain → one eligible buyer suffices
Implement: Update specification logic
```

**Iteration 6: Integration test for Twig component**
```
Test: Integration/Spi → canApplyDiscount() returns correct value
Implement: OrderHeader component method
```

### Flow Pattern

```
┌──────────────────────────────────────────────────────┐
│                     Happy Path                        │
│  Controller → Domain → SPI → Back to Controller      │
├──────────────────────────────────────────────────────┤
│                     Edge Cases                        │
│  Add tests for each edge case, implement fixes       │
└──────────────────────────────────────────────────────┘
```

## Phase 3: Refactor (After GREEN)

**After each GREEN iteration**, check for duplication to eliminate in both code **and** tests.

### Test Refactoring: Data Providers

**Rule**: When multiple test methods have the **same structure** (identical Arrange-Act-Assert) and only differ in **input data**, consolidate them into a data provider.

**Criterion**: No `if` in the test case. If all data can be passed as arguments with the same assertions, use a data provider.

```php
// ❌ BEFORE: duplication — same structure, only data changes
/** @test */
public function formIsValidWithInitialPayment(): void
{
    $form = $this->factory->create(MyForm::class);
    $form->submit(['type' => ['initial_payment']]);
    self::assertTrue($form->isValid());
}

/** @test */
public function formIsValidWithScheduledPayment(): void
{
    $form = $this->factory->create(MyForm::class);
    $form->submit(['type' => ['scheduled_payment']]);
    self::assertTrue($form->isValid());
}

// ✅ AFTER: data provider — one method, N cases
/**
 * @test
 * @dataProvider provideValidSelections
 */
public function formIsValid(array $selection): void
{
    $form = $this->factory->create(MyForm::class);
    $form->submit(['type' => $selection]);
    self::assertTrue($form->isValid());
}

public static function provideValidSelections(): \Generator
{
    yield 'initialPaymentOnly' => ['selection' => ['initial_payment']];
    yield 'scheduledPaymentOnly' => ['selection' => ['scheduled_payment']];
}
```

### When NOT to Use a Data Provider

- Assertions differ between cases (one test checks `isValid()`, another checks specific data)
- An `if` would be needed in the test to adapt behavior → keep separate methods
- The test has specific setup (different form options, initial data)

### Refactor Checklist

| Question | Action |
|----------|--------|
| Test methods with same structure? | Data provider |
| Duplicated production code? | Extract method/class |
| Unclear variable names? | Rename |
| Tests still green after refactor? | `make php/tests` |

---

## CRITICAL: Working Application at Each Iteration

**MANDATORY**: At the end of each GREEN iteration, the application MUST be functional in dev AND prod.

### The Incomplete Stubs Trap

```php
// ❌ FORBIDDEN: referencing a non-existent template
return new Response($this->twig->render('order/page.html.twig'));
// → The test may pass, but the app will be broken in dev/prod!

// ✅ CORRECT: return an empty Response OR create an empty template
return new Response('');  // Option A: no template
// OR
return new Response($this->twig->render('order/page.html.twig'));
// + create templates/order/page.html.twig (even empty)
```

### Golden Rule

> **Tests pass AND the application works** at every iteration.

### GREEN Iteration End Checklist

| Check | Action |
|-------|--------|
| Template referenced? | Create the file (even empty) |
| Service injected? | Declare in services.yaml |
| Interface used? | Implement or create a working stub |
| Route added? | Verify with `debug:router` |

### Correct Example - Iteration 1

```php
// Controller with empty Response (no template dependency)
#[Route('/orders/{uuid}/payment', name: 'add_payment_method')]
public function __invoke(): Response
{
    return new Response('');  // Works in tests AND in prod
}
```

```php
// OR Controller with an empty template created
#[Route('/orders/{uuid}/payment', name: 'add_payment_method')]
public function __invoke(): Response
{
    return new Response($this->twig->render('order/payment/form.html.twig'));
}
// + templates/order/payment/form.html.twig created (even empty)
```

### Quick Check

```bash
# After each GREEN, verify the app starts
docker compose exec php bin/console cache:clear
docker compose exec php bin/console lint:container
```

---

## CRITICAL: Always Run Tests

**MANDATORY**: After each phase (RED or GREEN), you MUST run the specific test to verify the expected behavior:

1. **After writing a test (RED)**: Run it to confirm it FAILS
2. **After writing implementation (GREEN)**: Run it to confirm it PASSES

```bash
# Run specific test file immediately after creating/modifying it
docker compose run --rm php ./vendor/bin/phpunit path/to/YourTest.php

# For packages in vendor/acme/*, run from package directory
cd vendor/acme/<package>/
docker compose run --rm php ./vendor/bin/phpunit tests/Path/To/YourTest.php
```

**Never assume a test passes without running it.**

## Bug Fix Workflow

**CRITICAL**: When the user reports something is broken or doesn't work, follow this workflow **before any code change**:

### Step 1: Find existing tests

```bash
# Search for test class related to the broken component
grep -r "ClassName" tests/
```

Ask yourself:
- Does a test exist for this behavior?
- If yes, why does it pass when the behavior is broken?
- Is the test using mocks that hide the real problem?

### Step 2: Write a failing test first

**MANDATORY**: Create or update a test that **reproduces the problem**.

```php
/** @test */
public function itDeserializesArrayOfProductsIntoResponse(): void
{
    // Use REAL dependencies (real serializer, not mocks) to expose the issue
    $result = $httpClient->__invoke();

    // This assertion should FAIL with the current implementation
    self::assertEquals($expected, $result);
}
```

### Step 3: Run the test - verify it FAILS

```bash
docker compose exec php ./vendor/bin/phpunit path/to/Test.php --testdox
```

**Expected output**: Test fails with a clear error message explaining the problem.

If the test passes, your test doesn't reproduce the issue. Investigate further.

### Step 4: Fix the implementation

Only now write the fix. The failing test guides the solution.

### Step 5: Run the test - verify it PASSES

```bash
docker compose exec php ./vendor/bin/phpunit path/to/Test.php --testdox
```

### Why This Workflow?

1. **Understanding**: The failing test forces you to understand the exact problem
2. **Regression prevention**: The test will catch if the bug returns
3. **Confidence**: You know the fix actually works
4. **Documentation**: The test documents what was broken and how it should work

### Common Mistake: Mocks hiding real issues

```php
// ❌ This test passes but hides a serialization bug
$serializer = $this->prophesize(SerializerInterface::class);
$serializer->deserialize(...)->willReturn($expectedResponse);  // Mock returns expected value!

// ✅ Use real serializer to catch real problems
$serializer = $this->createSerializer();
$result = $httpClient->__invoke();  // This will fail if deserialization is broken
```

## CRITICAL: New Code Must Have Tests

**MANDATORY**: When creating new production code (Feature, Controller, Service, etc.), you MUST also create corresponding tests.

### Checklist for new code

| Code Created | Tests Required |
|--------------|----------------|
| Feature class | Unit test for business logic |
| Controller | Functional test for endpoint |
| Repository | Integration test with database |
| Specification | Unit test for each rule |
| DTO/Contract | Serialization test (in package) |

### Example: Creating a GetOrderFeature

```
1. Create GetOrderFeature.php
2. Create GetOrderFeatureTest.php with:
   - Happy path: order with complete buyer
   - Edge case: order with incomplete buyer
   - Edge case: order not found
3. Create GetOrderController.php
4. Create GetOrderControllerTest.php with:
   - 200 OK with valid UUID
   - 404 when order not found
   - 401/403 without proper role
```

**Never consider a feature "done" without its tests.**

## Anti-Patterns

### ❌ Completing one layer before starting the next
Move between layers in small iterations.

### ❌ All tests for a feature before any implementation
One test → implement → repeat.

### ❌ Using Integration when Unit suffices
If no container needed, use `tests/Unit/`.

### ❌ Writing implementation before test
Always write failing test first.

### ❌ Skipping back to entry point
Return to API layer regularly to verify integration.

### ❌ Not running tests after each phase
Always execute the test to verify RED (fails) or GREEN (passes).

### ❌ Creating code without tests
Every new class needs corresponding test coverage.

### ❌ Incomplete stubs breaking the application
Never reference a non-existent template, service, or class. Tests may pass but the app will be broken in dev/prod. Always create files (even empty) or use working alternatives (`new Response('')`).

## Commands

```bash
# All tests
make php/tests

# Specific test file
docker compose exec php ./vendor/bin/phpunit tests/Unit/Domain/Model/Buyer/Discount/IsBuyerEligibleForDiscountTest.php

# Filter by test name
docker compose exec php ./vendor/bin/phpunit --filter=buyerWith100Percent
```
