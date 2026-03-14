---
name: ts-refactoring
description: This skill should be used when refactoring code, redesigning classes, or extracting value objects. Provides methodological principles for safe, well-informed refactoring.
version: "1.0"
---

# Refactoring Methodology (TypeScript)

## 1. Analyze the Complete Business Flow Before Refactoring

**Before touching the code, trace the data flow end-to-end.** A local refactoring that ignores the global flow produces incomplete abstractions.

### Problem

```typescript
// ❌ AVOID - Refactoring a controller without understanding the complete flow
// We create an UploadFile in the controller...
const uploadFile = new UploadFile(content, fileName);

// ...but we haven't seen that the same object is also created
// in downloadExistingFiles() with different data.
// Result: two inconsistent creation paths.
```

### Solution

```
// ✅ CORRECT - Trace the complete flow BEFORE refactoring
//
// 1. Identify all inputs: form, API, database
// 2. Trace each piece of data from source to final destination
// 3. Spot convergence points (same object, different sources)
// 4. Design the abstraction that covers ALL paths
//
// Example: UploadFile is created from:
//   - an uploaded file (form → File → UploadFile)
//   - an existing file re-downloaded (API → binary content → UploadFile)
// → The abstraction must unify both sources
```

**Criterion:** if an object can be constructed from N different sources, the refactoring must identify all of them before defining the structure.

## 2. Design by Tracing All Consumers

**When creating or modifying a value object, list all its consumers to define the necessary properties.** Don't limit yourself to the creation point.

### Problem

```typescript
// ❌ AVOID - Defining a value object only from its creation point
class UploadFile {
  constructor(
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}

// Later, a consumer needs the file type...
// We discover a missing property.
// The consumer must maintain an external mapping.
```

### Solution

```typescript
// ✅ CORRECT - Analyze consumers before defining the structure
//
// Steps:
// 1. List all places that CONSUME the object
// 2. For each consumer, note the data it needs
// 3. Include in the object everything consumers extract
//
// Consumer: repository.upload(file, request)
//   → needs file.content, file.originalFileName
//   → needs request.fileType (comes from the file)
//
// → The type must be carried by UploadFile itself

class UploadFile {
  constructor(
    readonly type: FileType,
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}
```

**Criterion:** a value object is complete when no consumer needs an external mapping to interpret it.

## 3. Imports as Coupling Signal

**A file's imports reveal its actual dependencies.** After a refactoring, verify that remaining imports are consistent with the class's responsibility.

### Problem

```typescript
// ❌ AVOID - A service that imports infrastructure types
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// This domain service manipulates HTTP and DB types directly.
// The imports betray a leaky abstraction.
```

### Solution

```typescript
// ✅ CORRECT - Imports reflect the right abstraction level
import { UploadFile } from '../domain/upload-file';
import { TenantRepository } from '../domain/ports/tenant-repository';

// The service only manipulates domain objects.
// The conversion from HTTP/DB types is done at the boundaries.
//
// Post-refactoring verification:
// 1. List the file's imports
// 2. Does each import belong to this class's responsibility?
// 3. A "foreign" import signals misplaced responsibility
```

**Criterion:** after a refactoring, if a file imports a type that doesn't match its layer/responsibility, it signals that code should be moved.

## 4. Value Objects Must Include Everything Consumers Need

**A value object is complete when it carries all information its consumers need**, without requiring them to look it up elsewhere.

> **See also**: `ts-oop` rule #5 (Self-Descriptive Value Objects) for the pattern.

### Checklist Before Extracting a Value Object

1. List all creation points (where is it constructed?)
2. List all consumers (where is it used?)
3. For each consumer, what data does it extract?
4. Include ALL extracted data as properties
5. If a consumer needs an external mapping → missing property

## Quick Reference

| Rule | Principle |
|------|-----------|
| Complete business flow | Trace all sources and destinations before refactoring |
| Trace consumers | List all usages to define a value object's structure |
| Imports = coupling | Imports reveal dependencies; verify their coherence |
| Complete value objects | Include everything consumers need, no external mappings |
