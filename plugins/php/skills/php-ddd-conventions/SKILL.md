---
name: php-ddd-conventions
description: "ACTIVATE when writing or modifying domain layer code, creating value objects, specifications, domain services, or domain interfaces. ACTIVATE when 'domain', 'DDD', 'hexagonal', 'ports and adapters', or 'domain purity' appears. Covers: strict domain layer purity rules — what is forbidden vs allowed in the domain layer, SPI interface pattern. DO NOT use for: infrastructure/controller code, Doctrine mapping, general architecture questions."
version: "1.1"
---

# DDD Conventions

## Domain Layer Purity

The domain layer contains business logic only. Infrastructure leaks into the domain are the most common architectural violation.

### Forbidden in Domain Layer

- `Symfony\Component\HttpFoundation\File\UploadedFile` — use `string $filePath` or a domain abstraction
- HTTP classes (Request, Response, etc.)
- Database/ORM classes (Doctrine entities, repository implementations)
- Framework-specific validators

### Allowed in Domain Layer

- Pure PHP types (string, int, array, DateTimeInterface, etc.)
- Domain value objects
- Domain interfaces (defined in Domain, implemented in SPI)
- DTO classes from contracts packages

### Why This Matters

When the domain imports infrastructure types, it becomes untestable without the framework and impossible to reuse. Domain interfaces (SPI) are the boundary: defined in Domain, implemented in infrastructure.
