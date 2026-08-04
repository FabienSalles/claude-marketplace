---
name: php-8-0
description: "ACTIVATE when calling a constructor, method or function with four or more arguments in a PHP 8.0+ project — value objects, contract requests, factories, projections, test fixtures. Covers: mandatory named arguments from the fourth argument on. DO NOT use for: calls of three arguments or fewer, PHP 8.1 features (see php-8-1), PHP 8.2 features (see php-8-2), PHP 8.3 features (see php-8-3)."
version: "1.0"
---

# PHP 8.0 Conventions

The key project convention: **from the fourth argument on, name every argument**.
Three positional arguments or fewer stay positional.

## Named Arguments Past Three

```php
// AVOID: six positional arguments, no call site tells you what they mean
new SwisslifeOtherSource('400', 'Succession', '2019-06-14', 'FR', 'Notaire Martin', 'Banque Populaire');

// CORRECT: named from the fourth on — here, all of them
new SwisslifeOtherSource(
    amount: '400',
    justification: 'Succession',
    date: '2019-06-14',
    countryCode: 'FR',
    fundIssuer: 'Notaire Martin',
    depositoryInstitution: 'Banque Populaire',
);

// CORRECT: three arguments, positional is fine
new SwisslifeEmploymentIncomeSource('Eres', 'FR', '600');
```

**All or nothing on a given call.** Once the threshold is crossed, name every
argument rather than only the ones past the third: a call that mixes
`('400', 'Succession', date: '2019-06-14', …)` reads worse than either form, and
PHP forbids a positional argument after a named one anyway.

**Why four.** Below that, the parameter list is short enough that the signature is
one glance away and the names add noise. Past it, a reader has to count commas
against a constructor they cannot see, and two adjacent arguments of the same type
become a silent swap the type system cannot catch. `SwisslifeOtherSource` above
takes six strings in a row — nothing but the order distinguishes a fund issuer
from a depository institution.

The rule also survives refactors: inserting a parameter, reordering, or making one
optional breaks positional call sites silently and named ones loudly.

## Where it bites most

- **Value objects and contract requests** — long constructors of same-typed
  scalars, exactly where a swap compiles and passes tests.
- **Factories** whose parameter order differs from the object they build. Real
  case: `SpiricaDeclarationFactory::createDatedDetailedSource($option,
  $justification, $date, $amount)` against `new SpiricaDatedDetailedSource(
  $justification, $amount, $date)` — two orders for the same three values.
- **Test fixtures and projections**, where a wrong-but-plausible argument produces
  a green test asserting the wrong thing.

Applies to constructors, static factories, instance methods and plain functions
alike. Native functions with a conventional signature everyone reads at a glance
(`str_replace`, `number_format`, `array_slice`) are the one place where the count
is not worth enforcing.
