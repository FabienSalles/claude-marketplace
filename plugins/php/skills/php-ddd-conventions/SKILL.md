---
name: php-ddd-conventions
description: "ACTIVATE when writing or modifying domain layer code in PHP/Symfony, creating value objects, specifications, domain services, or domain interfaces. ACTIVATE for 'domain', 'DDD', 'hexagonal', 'ports and adapters', 'domain purity' in PHP context. Provides PHP/Symfony-specific examples for cross-language OOP DDD principles defined in craft:ddd-principles. DO NOT use for: infrastructure/controller code, Doctrine mapping, general architecture questions."
version: "2.0"
---

# DDD Conventions — PHP / Symfony

> The **cross-language OOP DDD principles** (domain purity, ports & adapters, dependency direction, bounded contexts, aggregates, value objects) are defined in `craft:ddd-principles`. This skill keeps PHP/Symfony-specific lists and patterns.

## PHP/Symfony-specific: Forbidden in Domain Layer

In a Symfony codebase, these concrete classes / types are typical infrastructure leaks:

- `Symfony\Component\HttpFoundation\File\UploadedFile` → use `string $filePath` or a domain abstraction (`UploadFile` model)
- HTTP classes: `Request`, `Response`, `RedirectResponse`, etc.
- Database / ORM: Doctrine entities, repository **implementations**, `EntityManagerInterface`
- Framework-specific validators / constraints (Symfony validator components)

## PHP/Symfony-specific: Allowed in Domain Layer

- Pure PHP types (`string`, `int`, `array`, `DateTimeInterface`, `DateTimeImmutable`)
- Domain value objects (final readonly classes, no framework dependency)
- **Domain interfaces** (defined in `Domain/`, implemented in `Infrastructure/`)
- DTO classes from contracts packages (e.g. `vendor/acme/contracts`)

## PHP/Symfony-specific: SPI Pattern

In a Symfony hexagonal project, the convention for the **Service Provider Interface** (SPI):

- The interface lives in the **Domain** layer (e.g. `src/Domain/Subscription/Port/SubscriptionRepository.php`).
- The concrete implementation lives in **Infrastructure** (e.g. `src/Infrastructure/Doctrine/DoctrineSubscriptionRepository.php`).
- Domain code depends on the interface only.

## Quick Reference (PHP-specific)

| Forbidden in domain | Why |
|---------------------|-----|
| `UploadedFile` | Form-internal type — use domain `UploadFile` |
| `Request` / `Response` | HTTP-internal — should never reach the domain |
| Doctrine entities | ORM-internal — keep domain models pure |
| Symfony validators | Framework-internal — use domain invariants |

| Allowed in domain | Examples |
|-------------------|----------|
| Pure PHP types | `string`, `int`, `DateTimeImmutable`, `array` |
| Domain VOs | `final readonly class Money { … }` |
| Domain interfaces | SPI ports, defined in domain, implemented in infra |
| Contract DTOs | From `vendor/acme/contracts` |
