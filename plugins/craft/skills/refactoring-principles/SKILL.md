---
name: refactoring-principles
description: "ACTIVATE for any refactoring, extract, redesign, simplify, or cleanup request across languages. Covers cross-language refactoring principles: trace business flow before refactoring, consumer-driven value object design, imports as coupling signals, value object completeness checklist. Language-specific examples live in companion skills (php-refactoring, ts-refactoring, etc.). DO NOT use for: writing new features from scratch (see *-tdd-workflow), general OOP principles (see *-oop)."
version: "1.0"
---

# Refactoring — Cross-Language Principles

> This skill defines the **abstract rules**. Language-specific examples live in:
> - `php-refactoring` (PHP / Symfony)
> - `ts-refactoring` (TypeScript / Node)
> - (others as they join the stack)

## 1. Trace the Complete Business Flow BEFORE Refactoring

A local refactoring that ignores the global flow produces incomplete abstractions. Before touching any code, trace the data flow end-to-end.

**Process:**

1. Identify all inputs: form, API, database, file system, etc.
2. Trace each piece of data from source to final destination.
3. Spot convergence points (same object, different sources).
4. Design the abstraction that covers ALL paths.

**Criterion:** if an object can be constructed from N different sources, the refactoring must identify all of them before defining the structure.

## 2. Design by Tracing All Consumers (Consumer-Driven Value Objects)

When creating or modifying a value object, list all its consumers to define the required properties. Do not limit the analysis to the creation point.

**Process:**

1. List every place that CONSUMES the object.
2. For each consumer, note the data it needs.
3. Include in the object everything consumers extract.

**Criterion:** a value object is complete when no consumer needs an external mapping to interpret it.

## 3. Imports as a Coupling Signal

A file's imports reveal its real dependencies. After a refactoring, verify that remaining imports are consistent with the class's responsibility.

**Post-refactoring check:**

1. List the imports of the modified file.
2. Does each import belong to this class's layer/responsibility?
3. A "foreign" import signals misplaced responsibility — move the code.

**Criterion:** if a file imports a type that does not match its layer/responsibility, code needs to be moved.

## 4. Value Object Completeness Checklist

Before considering an extracted value object "done":

1. List all creation points (where is it constructed?).
2. List all consumers (where is it used?).
3. For each consumer, what data does it extract?
4. Include ALL extracted data as properties.
5. If a consumer needs an external mapping → missing property.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Complete business flow | Trace all sources and destinations before refactoring |
| Trace consumers | List all usages to define a value object's structure |
| Imports = coupling | Imports reveal dependencies; verify their consistency |
| Complete value objects | Include everything consumers need; no external mappings |
