---
name: ts-refactoring
description: "ACTIVATE when refactoring TypeScript code. ACTIVATE for 'refactor', 'extract', 'redesign', 'simplify', or 'clean up' in a TypeScript / Node / NestJS context. This skill provides TS-specific examples for the cross-language refactoring rules defined in craft:refactoring-principles. DO NOT use for: writing new features from scratch, general OOP patterns (see ts-oop)."
version: "2.0"
---

# Refactoring — TypeScript Examples

> The **rules** are defined in `craft:refactoring-principles` (cross-language). This skill provides TypeScript / Node examples only. Load both for the full picture.

## Example — Rule 1: Trace the Complete Business Flow

```typescript
// ❌ AVOID — refactoring without understanding the full flow
const uploadFile = new UploadFile(content, fileName);

// ...but UploadFile is also created in downloadExistingFiles() with
// different data. Two inconsistent creation paths.
//
// Sources you must identify BEFORE refactoring:
//   - browser File API:  File              → UploadFile
//   - API download:      binary content    → UploadFile
//
// → The abstraction must unify both sources.
```

## Example — Rule 2: Consumer-Driven Value Object

```typescript
// ❌ AVOID — VO defined only from its creation point
class UploadFile {
  constructor(
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}

// Later, a consumer needs the file type → external mapping required.
//   repository.upload(file, request)
//     uses  file.content, file.originalFileName, request.fileType
//   → fileType comes from the file itself, NOT the request.

// ✅ CORRECT — include FileType because a consumer needs it
class UploadFile {
  constructor(
    readonly type: FileType,
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}
```

## Example — Rule 3: Imports as a Coupling Signal

```typescript
// ❌ AVOID — a domain service importing infrastructure types
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// The domain service manipulates HTTP and DB types directly.
// The imports betray a leaky abstraction.

// ✅ CORRECT — imports reflect the right abstraction level
import { UploadFile } from '../domain/upload-file';
import { TenantRepository } from '../domain/ports/tenant-repository';

// The service only manipulates domain objects. HTTP/DB type conversion
// happens at the boundaries (controllers, adapters).
```

## TypeScript-specific note

> See `ts-oop`'s "TS-specific: Branded Types for Primitive Identifiers" heading for the branded-type pattern that complements rule 2 above.
