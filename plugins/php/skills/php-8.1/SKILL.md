---
name: php-8.1
description: "ACTIVATE when passing a method as a callback in a PHP 8.1+ project — event listeners, validator callbacks, Twig functions, array_map/usort callables. Covers: mandatory first-class callable syntax `$this->method(...)` over array/string callables. DO NOT use for: general PHP syntax, PHP 8.2 features (see php-8.2), PHP 8.3 features (see php-8.3)."
version: "1.0"
---

# PHP 8.1 Conventions

The key project convention: reference a method callback with the **first-class
callable syntax** `$this->method(...)` (or `self::method(...)`), never an array
`[$this, 'method']` / `[self::class, 'method']` or string `'method'` callable.

## First-class Callable Syntax

```php
// AVOID: array / string callable references
$builder->addEventListener(FormEvents::PRE_SUBMIT, [$this, 'cleanScheduledPayment']);
new Assert\Callback([self::class, 'validateSingleDefaultAccount']);
usort($items, [$this, 'compareByAmount']);

// CORRECT: first-class callable
$builder->addEventListener(FormEvents::PRE_SUBMIT, $this->cleanScheduledPayment(...));
new Assert\Callback($this->validateSingleDefaultAccount(...));
usort($items, $this->compareByAmount(...));
```

**Why:** the `(...)` form is resolved at compile time, so the method must exist —
the IDE navigates to it, static analysis catches typos and signature drift, and
refactors/renames update the reference. Array/string callables are opaque strings
that silently rot.

Applies to every callback handed to a framework API: form event listeners,
`Assert\Callback` constraints, `TwigFunction`/`TwigFilter`, and native callable
consumers such as `usort`. The referenced method stays `private` unless an
external consumer needs it.
