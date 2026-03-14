---
name: php-ddd-conventions
description: This skill should be used when writing domain code. Enforces Domain-Driven Design principles by forbidding infrastructure dependencies in the domain layer.
version: "1.0"
---

# DDD Conventions

## Domain Layer Purity

The domain layer MUST NOT depend on infrastructure concerns.

### Forbidden in Domain Layer

- `Symfony\Component\HttpFoundation\File\UploadedFile` - Use `string $filePath` or a domain abstraction
- HTTP-related classes (Request, Response, etc.)
- Database/ORM classes (Doctrine entities, repositories implementations)
- Framework-specific validators

### Allowed in Domain Layer

- Pure PHP types (string, int, array, DateTimeInterface, etc.)
- Domain value objects
- Domain interfaces (defined in Domain, implemented in SPI)
- DTO classes from contracts packages
