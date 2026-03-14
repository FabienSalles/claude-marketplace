---
name: php-code-conventions
description: This skill should be used when writing new code in "src/", creating controllers, services, repositories, specifications, or Twig components. Provides the project's architecture conventions and coding standards.
version: "1.0"
---

# Code Conventions

This skill documents PHP coding conventions for PHP/Symfony projects.

## Standards Compliance

**All code MUST comply with:**
- All [PSR standards](https://www.php-fig.org/psr/) (including PSR-12)
- [PER Coding Style](https://www.php-fig.org/per/coding-style/)

The rules below are **project-specific conventions** that go beyond these standards.

## Control Structure Spacing

**IMPORTANT**: Always add blank lines before and after control structures (`foreach`, `for`, `while`, `if`, `switch`) when they are not at the start or end of a block.

> This rule is not in PSR-12/PER (which only states blank lines "MAY be added"). In this project, they are **required**.

### Foreach

```php
// ❌ Avoid - No blank lines around foreach
$codes = [];
foreach ($offers as $offer) {
    $codes[$offer->getCode()] = true;
}
$this->offerCodes = $codes;

// ✅ Correct - Blank lines before and after foreach
$codes = [];

foreach ($offers as $offer) {
    $codes[$offer->getCode()] = true;
}

$this->offerCodes = $codes;
```

### If statements

```php
// ❌ Avoid
$result = null;
if ($condition) {
    $result = 'value';
}
return $result;

// ✅ Correct
$result = null;

if ($condition) {
    $result = 'value';
}

return $result;
```

### Exception: Start/End of block

No blank line needed when the control structure is at the start or end of a method/block:

```php
// ✅ Correct - foreach at start of method
public function process(): void
{
    foreach ($items as $item) {
        // ...
    }

    $this->finalize();
}

// ✅ Correct - if at end of method
public function validate(): bool
{
    $isValid = $this->check();

    if (!$isValid) {
        return false;
    }
}
```

## Early Return Pattern

**Always use early return** to handle edge cases and invalid conditions first. This reduces nesting and improves readability.

### Problem

```php
// ❌ AVOID - Nested condition with main logic inside if
private function validateOtherNature(FormEvent $event): void
{
    $form = $event->getForm();
    $otherShare = $form->get('other_share')->getData();
    $otherNature = $form->get('other_nature')->getData();

    if ($otherShare > 0 && $otherNature === '') {
        $form->get('other_nature')->addError(new FormError('Required'));
    }
}
```

### Solution

```php
// ✅ CORRECT - Early return for valid cases
private function validateOtherNature(FormEvent $event): void
{
    $form = $event->getForm();
    $otherShare = $form->get('other_share')->getData();
    $otherNature = $form->get('other_nature')->getData();

    if ($otherShare <= 0 || $otherNature !== '') {
        return;
    }

    $form->get('other_nature')->addError(new FormError('Required'));
}
```

### Blank line before return

When `return` is preceded by other statements in a block, add a blank line:

```php
// ✅ CORRECT - Blank line before return
if ($otherShare <= 0 || $otherNature !== '') {
    return;
}

// ✅ CORRECT - No blank line when return is alone
if ($total === 100) {
    return;
}

// ❌ AVOID - Missing blank line before return
if ($condition) {
    $this->doSomething();
    return; // Missing blank line above
}

// ✅ CORRECT
if ($condition) {
    $this->doSomething();

    return;
}
```

### Benefits

- **Reduces indentation**: Main logic stays at base level
- **Clarifies intent**: Edge cases are handled first
- **Easier to read**: No need to scroll to find the "else" case

## If Continue Pattern in Loops

`continue` in a loop is the equivalent of early return in a function. **Use `continue` only when the exit condition is simple and the main processing is more complex** — i.e., when `continue` serves to "clear the simple case" to keep the main logic at the first indentation level.

When both branches have comparable complexity, prefer a classic `if/else` for readability.

```php
// ✅ CORRECT - continue to clear the simple case, main logic below
foreach ($items as $item) {
    if (!$item->isActive()) {
        $this->logger->debug(sprintf('Skipping inactive item %s', $item->getId()));

        continue;
    }

    $price = $this->calculatePrice($item);
    $discount = $this->applyDiscount($price, $item->getCategory());
    $results[] = new PricedItem($item, $price - $discount);
}

// ✅ CORRECT - if/else quand les deux branches ont une complexité comparable
foreach ($fieldNames as $index => $fieldName) {
    if ($index === $lastIndex) {
        $form->get($fieldName)->addError(new FormError($errorMessage));
    } else {
        $form->get($fieldName)->addError(new FormError(''));
    }
}

// ❌ AVOID - continue quand les deux branches sont aussi simples
foreach ($fieldNames as $index => $fieldName) {
    if ($index !== $lastIndex) {
        $form->get($fieldName)->addError(new FormError(''));

        continue;
    }

    $form->get($fieldName)->addError(new FormError($errorMessage));
}
```

> **Note**: Add a blank line before `continue` (and `return`, `break`, `throw`) when preceded by other statements in the block.

### When to apply

- When the exit condition is simple and the main logic is more complex
- When `continue` serves to "clear the simple case" like early return does in functions

### When NOT to apply

- When both branches have comparable complexity — use `if/else` instead

## Nullsafe Operator to Flatten Nested Ifs

**Use the nullsafe operator `?->`** to avoid nested null checks.

### Problem

```php
// ❌ AVOID - Deeply nested if statements
if ($buyer->shippingPreferences !== null) {
    if ($buyer->shippingPreferences->isPremium === true) {
        $types[] = 'premium_member';
    }

    if ($buyer->shippingPreferences->shippingTier !== null) {
        $type = $this->mapType($buyer->shippingPreferences->shippingTier);

        if ($type !== null) {
            $types[] = $type;
        }
    }
}
```

### Solution

```php
// ✅ CORRECT - Flat structure with nullsafe operator
if ($buyer->shippingPreferences?->isPremium === true) {
    $types[] = 'premium_member';
}

$type = $this->mapType($buyer->shippingPreferences?->shippingTier);

if ($type !== null) {
    $types[] = $type;
}
```

### Match with null

When using `match` with nullable input, add `null` as a case:

```php
private function mapType(?ShippingTierEnum $capacity): ?string
{
    return match ($capacity) {
        ShippingTierEnum::EXPRESS => 'express',
        ShippingTierEnum::STANDARD => 'standard',
        ShippingTierEnum::ECONOMY, null => null,
    };
}
```

## Avoid empty() Function

**NEVER use the `empty()` function.** Use explicit comparisons instead.

> The `empty()` function has unpredictable behavior with different types and hides potential bugs.

### Arrays

```php
// ❌ AVOID
if (empty($array)) {
    return false;
}

// ✅ CORRECT
if ($array === []) {
    return false;
}
```

### Strings

```php
// ❌ AVOID
if (empty($string)) {
    return false;
}

// ✅ CORRECT
if ($string === '') {
    return false;
}
```

### Other types

```php
// ❌ AVOID
if (empty($value)) { ... }

// ✅ CORRECT - Be explicit about what you're checking
if ($value === null) { ... }
if ($value === 0) { ... }
if ($value === false) { ... }
```

## Parameter Ordering

In constructors, mandatory parameters come first, then optional ones. Within each group, promoted properties come before simple parameters:

1. **Promoted mandatory** (`public`/`private`/`protected`, required)
2. **Simple mandatory** (non-promoted, required)
3. **Promoted optional** (`public`/`private`/`protected`, nullable)
4. **Simple optional** (non-promoted, nullable)

```php
// ✅ Correct - mandatory first (promoted then simple), optional last (promoted then simple)
public function __construct(
    public string $orderUuid,
    public string $buyerUuid,
    private int $totalItems,
    \DateTimeImmutable $now,
    private ?float $discountRate,
    private ?ShippingDetails $shippingDetails,
    ?\DateTimeInterface $birthDate,
) {
}

// ❌ Avoid - optional before mandatory, simple before promoted
public function __construct(
    public string $orderUuid,
    ?\DateTimeInterface $birthDate,
    private int $totalItems,
    ?float $discountRate,
    \DateTimeImmutable $now,
) {
}
```

## Heredoc and Nowdoc (PER Coding Style Section 10)

**Reference**: [PER Coding Style - Section 10](https://www.php-fig.org/per/coding-style/#10-heredoc-and-nowdoc)

### Prefer Nowdoc

**A nowdoc SHOULD be used wherever possible.** Heredoc MAY be used only when a nowdoc does not satisfy requirements.

```php
// ✅ CORRECT - Nowdoc (with single quotes)
$query = <<<'SQL'
    SELECT * FROM table
    SQL;

// ❌ AVOID - Heredoc (without quotes) unless variable interpolation is needed
$query = <<<SQL
    SELECT * FROM table
    SQL;
```

### Indentation Rules

1. Declaration begins on the **same line** as its context (assignment, parameter)
2. Content is indented **once past the scope indentation**
3. Closing identifier is at the **same indentation level as the content**

### Compliant Examples (from PER)

```php
function allowed()
{
    $allowedHeredoc = <<<COMPLIANT
        This
        is
        a
        compliant
        heredoc
        COMPLIANT;

    $allowedNowdoc = <<<'COMPLIANT'
        This
        is
        a
        compliant
        nowdoc
        COMPLIANT;

    var_dump(
        'foo',
        <<<'COMPLIANT'
            This
            is
            a
            compliant
            parameter
            COMPLIANT,
        'bar',
    );
}
```

### Non-Compliant Examples (from PER)

```php
// ❌ Declaration on different line than context
$notAllowed =
<<<'COUNTEREXAMPLE'
    This
    is
    not
    allowed.
    COUNTEREXAMPLE;

// ❌ Content not indented past scope
function notAllowed()
{
    $notAllowed = <<<'COUNTEREXAMPLE'
This
is
not
allowed.
COUNTEREXAMPLE;
}
```

## Quick Reference

| Rule | Example |
|------|---------|
| Early return | `if (invalid) { return; }` then main logic |
| If continue in loops | Only when simple condition vs complex main logic |
| If/else in loops | When both branches have comparable complexity |
| Blank line before flow control | `$x = 1;` ⏎ ⏎ `return;` / `continue;` / `break;` |
| Blank line before control structure | `$x = 1;` ⏎ ⏎ `foreach (...)` |
| Blank line after control structure | `}` ⏎ ⏎ `$y = 2;` |
| Exception: start of block | No blank line needed |
| Exception: end of block | No blank line needed |
| Nullsafe for nested null checks | `$a?->b?->c` instead of nested `if` |
| No `empty()` function | `$array === []` instead of `empty($array)` |
| Prefer nowdoc | `<<<'SQL'` instead of `<<<SQL` |
| Heredoc/nowdoc indentation | Content +1 level, closing same as content |
