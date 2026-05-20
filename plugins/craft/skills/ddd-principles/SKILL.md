---
name: ddd-principles
description: "ACTIVATE when designing the domain layer in OOP languages — bounded contexts, aggregates, value objects, layer purity, ports/adapters, dependency direction. ACTIVATE for 'domain', 'DDD', 'hexagonal', 'ports and adapters', 'domain purity', 'bounded context', 'aggregate'. Provides cross-language OOP-style DDD principles. For functional-style DDD (immutable records, smart constructors, pipelines) see craft:ddd-fp-principles. Language-specific examples live in php-ddd-conventions, nest-ddd-conventions."
version: "1.0"
---

# DDD — Cross-Language OOP Principles

> The **rules** below are language-agnostic OOP-style DDD. Language-specific examples (forbidden imports, Symbol tokens, module structure) live in:
> - `php-ddd-conventions` (PHP / Symfony)
> - `nest-ddd-conventions` (TypeScript / NestJS)
>
> For **functional-style** DDD (immutable records, curried operations, Result pipelines), see `craft:ddd-fp-principles`.

## 1. Domain Layer Purity

The domain layer contains **business logic only**. Infrastructure leaks into the domain are the most common architectural violation — they make the domain untestable without the framework and impossible to reuse.

### Forbidden in the Domain Layer

- Framework HTTP types (`Request`, `Response`, framework `UploadedFile`, etc.)
- ORM / database classes (Doctrine entities, Drizzle schemas, Prisma client)
- DI decorators / framework annotations (`@Injectable`, `@Module`, `@Inject`, etc.)
- Framework-specific validators
- Any external library tied to a framework

### Allowed in the Domain Layer

- Pure language types (string, int, Date, plain record, etc.)
- Domain value objects (immutable, no framework dependency)
- Domain interfaces (defined in domain, implemented in infrastructure)
- Shared DTOs from contracts packages (typically `packages/shared` or equivalent)
- Enums / constant unions / branded types

**Criterion:** if the domain layer compiles WITHOUT the framework, it's pure.

## 2. Ports & Adapters

The boundary between domain and infrastructure is a set of **interfaces (ports)** defined in the domain, implemented as **adapters** in the infrastructure.

- Ports = pure interfaces, in the domain layer
- Adapters = concrete implementations, in the infrastructure layer
- The domain depends only on its own interfaces
- The infrastructure imports the domain — never the reverse

## 3. Dependency Direction (always inward)

```
Controllers / HTTP   →   Use Cases   →   Domain Services   →   Domain Ports
                                                                     ↑
   Infrastructure Adapters (DB, HTTP clients, …) ───────────────────┘
        (implement the domain ports)
```

**Rule:** dependencies always flow **inward** toward the domain. Outer layers know about inner layers; inner layers know nothing about outer layers.

## 4. Bounded Contexts

A bounded context is a clearly delimited part of the system with its **own ubiquitous language**. Each bounded context maps to a separate module / namespace / directory.

- 1 bounded context = 1 module (NestJS) / 1 namespace (PHP) / 1 directory (others)
- Bounded contexts communicate through explicit contracts (DTOs, events) — never by sharing internals

## 5. Aggregates

An aggregate is a state-bearing cluster of domain objects with:

- A single **transactional boundary** — all invariants of the aggregate must hold at commit time.
- A single **aggregate root** with an identity.
- External references go through the root only.

## 6. Value Objects

Value objects are defined by their **attributes**, not by an identity:

- **Immutable** (use `readonly` / `final readonly` / equivalent).
- Equality is by attribute equality, not by reference.
- May enforce invariants in the constructor (positive amount, valid format, etc.).

## Quick Reference

| Rule | Principle |
|------|-----------|
| Domain purity | No framework / ORM / HTTP in the domain layer |
| Ports & adapters | Interfaces in domain, implementations in infrastructure |
| Dependency direction | Always inward toward the domain |
| Bounded context | 1 module / namespace / directory per context |
| Aggregate | Single transactional boundary + identified root |
| Value object | Immutable, equality by attributes, may enforce invariants |
