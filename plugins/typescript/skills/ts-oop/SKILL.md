---
name: ts-oop
description: "ACTIVATE when designing TypeScript classes, value objects, collections, or when the user asks about object design, encapsulation, Tell Don't Ask, or Symbol.iterator. Provides TS-specific examples for the cross-language OOP rules defined in craft:oop-principles, plus TS-specific patterns (Symbol.iterator, branded types for primitive identifiers). DO NOT use for: functional DDD modeling (see ddd-ts-fp), refactoring methodology (see ts-refactoring)."
version: "2.0"
---

# OOP — TypeScript Examples

> The **rules** are defined in `craft:oop-principles`. This skill provides TypeScript / NestJS examples plus TS-specific patterns (`Symbol.iterator`, branded types).

> See also: `ts-conventions` for typing rules (strict mode, etc.).

## Example — Rule 1: Tell Don't Ask

```typescript
// ❌ AVOID — caller interrogates and decides
const requiredFields = identityDocument.getRequiredFieldNames();
for (const fieldName of requiredFields) {
  const file = identityDocument.getFileByFieldName(fieldName);
  if (file !== null) continue;

  const existing = existingFiles.find(fieldName);
  if (existing === null) continue;

  // ... re-download logic
}

// ✅ CORRECT — object exposes behavior
for (const [fieldName, existingFile] of identityDocument.getMissingExistingFiles()) {
  // Object already determined which files are missing
}
```

## Example — Rule 2: Collection Over Named Properties

```typescript
// ❌ AVOID — N separate fields with parallel handling
class FormData {
  private frontFile: File | null = null;
  private backFile: File | null = null;
  private passportFile: File | null = null;

  getFileByFieldName(name: string): File | null {
    switch (name) {
      case 'front_file':    return this.frontFile;
      case 'back_file':     return this.backFile;
      case 'passport_file': return this.passportFile;
      default:              return null;
    }
  }
}

// ✅ CORRECT — one keyed collection
class FormData {
  private readonly files = new Map<string, File>();

  addFile(fieldName: string, file: File): void {
    this.files.set(fieldName, file);
  }

  getFiles(): ReadonlyMap<string, File> {
    return this.files;
  }
}
```

## Example — Rule 3: Whole Object

```typescript
// ❌ AVOID — caller destructures
collection.add({
  documentType: document.type,
  documentName: document.originalFileName,
  downloadUrl: url,
});

// ✅ CORRECT — pass the whole object
collection.addFromDocument(document, url);
```

## Example — Rule 4: Iterable Collections via `Symbol.iterator`

TS-specific: implement `Symbol.iterator` to allow `for...of` while keeping internals private.

```typescript
class FilesCollection implements Iterable<[string, FileInfo]> {
  private readonly files = new Map<string, FileInfo>();

  add(name: string, file: FileInfo): void {
    this.files.set(name, file);
  }

  [Symbol.iterator](): Iterator<[string, FileInfo]> {
    return this.files.entries();
  }
}

// Clean usage
for (const [name, file] of collection) { /* ... */ }
```

## Example — Rule 5: Self-Descriptive Value Object

```typescript
// ❌ AVOID — consumer needs an external mapping
class UploadFile {
  constructor(
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}
// Controller maintains fieldName → fileType outside the object

// ✅ CORRECT — object carries its own type
class UploadFile {
  constructor(
    readonly type: FileType,
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}
```

## TS-specific: Branded Types for Primitive Identifiers

Use branded types to make identifiers self-descriptive and prevent accidental swaps at compile-time:

```typescript
type TenantId   = string & { readonly __brand: 'TenantId' };
type LandlordId = string & { readonly __brand: 'LandlordId' };

// ❌ Compile-time error — cannot pass TenantId where LandlordId expected
function getReceipts(landlordId: LandlordId): Receipt[] { /* ... */ }
getReceipts(tenantId); // Type error

// Factory function
function toTenantId(id: string): TenantId {
  return id as TenantId;
}
```

> See also: `ts-conventions` for more on branded types and type-safety patterns.
