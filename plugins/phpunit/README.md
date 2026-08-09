# phpunit

PHPUnit testing discipline for PHP projects, extracted from the original monolithic `php` plugin so a user on Laravel, Drupal, or a pure-PHP library can pull just the testing skills without dragging in Symfony-specific conventions.

## Install

```text
/plugin install phpunit@fabien-claude-marketplace
```

Or `./setup.sh --pack phpunit` (dev mode).

## Skills (2)

| Skill | Purpose |
|---|---|
| [`php-tdd-workflow`](skills/php-tdd-workflow/SKILL.md) | TDD workflow for PHP / Symfony: iteration examples, end-of-GREEN checklist (template ? services.yaml ? `bin/console debug:router` ?), data providers refactor, Prophecy mocking pitfalls, PHPUnit commands (`make php/tests`, `docker compose exec php ./vendor/bin/phpunit`). |
| [`php-test-conventions`](skills/php-test-conventions/SKILL.md) | Test writing conventions: naming, Prophecy, doubles, factories, data providers, serialization tests. Framework-agnostic: anything needing a Symfony kernel lives in [`symfony:symfony-test-conventions`](../symfony/skills/symfony-test-conventions/SKILL.md). |

## Layering

This plugin **does not** restate the cross-language TDD process: that lives in [`craft:tdd-workflow-principles`](../craft/skills/tdd-workflow-principles/SKILL.md) and [`craft:testing-principles`](../craft/skills/testing-principles/SKILL.md). Both `craft` skills are framework-agnostic and apply unchanged to PHP, TypeScript, or any future stack. This `phpunit` plugin keeps only what's PHPUnit-specific.

```
craft:tdd-workflow-principles    ← WHAT to do (cross-language)
        ↑
phpunit:php-tdd-workflow         ← HOW in PHP/Symfony (concrete commands, Prophecy)
```

If you use Vitest instead, install [`vitest`](../vitest/): same layering on top of the same `craft` baseline.

## Recommended companion plugins

- [`php`](../php/): the PHP language conventions (8.2/8.3, code style, OOP, DDD, refactoring, SQL, Composer). Almost certainly enabled alongside.
- [`craft`](../craft/): the cross-language principles `php-tdd-workflow` references. Without `craft`, the cross-language sections become dangling references.
- [`symfony`](../symfony/): if your project uses Symfony. Adds FormType / Twig / PRG conventions on top of PHP + PHPUnit.
