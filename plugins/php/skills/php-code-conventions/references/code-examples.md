# PHP Code Convention Examples

## Table of Contents
- [Control Structure Spacing Examples](#control-structure-spacing-examples)
- [Early Return Detailed Examples](#early-return-detailed-examples)
- [If Continue Pattern Examples](#if-continue-pattern-examples)
- [Nullsafe Operator Examples](#nullsafe-operator-examples)
- [Avoid empty() Examples](#avoid-empty-examples)
- [Parameter Ordering Examples](#parameter-ordering-examples)
- [Heredoc and Nowdoc Examples](#heredoc-and-nowdoc-examples)

## Control Structure Spacing Examples

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

## Early Return Detailed Examples

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

## If Continue Pattern Examples

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

// ✅ CORRECT - if/else quand les deux branches ont une complexite comparable
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

## Nullsafe Operator Examples

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

## Avoid empty() Examples

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

## Parameter Ordering Examples

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

## Heredoc and Nowdoc Examples

**Reference**: [PER Coding Style - Section 10](https://www.php-fig.org/per/coding-style/#10-heredoc-and-nowdoc)

### Prefer Nowdoc

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
