---
name: ts-oop
description: This skill should be used when designing classes, value objects, collections, or refactoring object-oriented code. Provides OOP design principles for clean, well-structured TypeScript code.
version: "1.0"
---

# OOP Design Principles (TypeScript)

## 1. Tell Don't Ask

**The object that owns the data exposes behavior.** Calling code must not extract data to make decisions on behalf of the object.

### Problem

```typescript
// ❌ AVOID - The caller interrogates the object and decides
const requiredFields = identityDocument.getRequiredFieldNames();

for (const fieldName of requiredFields) {
  const file = identityDocument.getFileByFieldName(fieldName);

  if (file !== null) {
    continue;
  }

  const existing = existingFiles.find(fieldName);

  if (existing === null) {
    continue;
  }

  // ... re-download logic
}
```

### Solution

```typescript
// ✅ CORRECT - The object exposes behavior
for (const [fieldName, existingFile] of identityDocument.getMissingExistingFiles()) {
  // The object already determined which files are missing
}
```

## 2. Collection over Named Properties

**When elements share the same nature and undergo the same treatment**, prefer an indexed collection over separate named properties.

### Problem

```typescript
// ❌ AVOID - Separate properties = N identical code paths
class FormData {
  private frontFile: File | null = null;
  private backFile: File | null = null;
  private passportFile: File | null = null;

  getFileByFieldName(name: string): File | null {
    switch (name) {
      case 'front_file': return this.frontFile;
      case 'back_file': return this.backFile;
      case 'passport_file': return this.passportFile;
      default: return null;
    }
  }
}
```

### Solution

```typescript
// ✅ CORRECT - One collection, one loop
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

**Criterion:** if elements share the same type and undergo the same treatment (upload, validation, display), it's a collection — even if the count is known and fixed.

## 3. Whole Object — Pass the Entire Object

**When multiple parameters come from the same object, pass the object.** Extracting primitives on the caller side is a sign of *feature envy*.

### Problem

```typescript
// ❌ AVOID - The caller destructures the object
collection.add({
  documentType: document.type,
  documentName: document.originalFileName,
  downloadUrl: url,
});
```

### Solution

```typescript
// ✅ CORRECT - The object is passed whole
collection.addFromDocument(document, url);
```

The receiving method extracts what it needs. This encapsulates knowledge of the `document` structure.

## 4. Iterable Collections (`Symbol.iterator`)

**Implement `Symbol.iterator` when the collection will be iterated**, to keep the internal property private while allowing `for...of`.

### Problem

```typescript
// ❌ AVOID - Public property to allow iteration
class FilesCollection {
  files: FileInfo[] = [];
}

// Direct access to internal array
for (const file of collection.files) { ... }
collection.files.push(file); // uncontrolled mutation
```

### Solution

```typescript
// ✅ CORRECT - Iterable with private internals
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
for (const [name, file] of collection) { ... }
```

## 5. Self-Descriptive Value Objects with Branded Types

**Include type or identity in the value object** so consumers don't need external mappings to interpret it.

### Problem

```typescript
// ❌ AVOID - The consumer needs an external mapping
class UploadFile {
  constructor(
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}

// The controller must maintain a fieldName → fileType mapping
for (const [fieldName, fileType] of fileTypeMapping) {
  const request = new UploadRequest(fileType, expirationDate);
  repository.upload(files[fieldName], request);
}
```

### Solution

```typescript
// ✅ CORRECT - The object carries its own type
class UploadFile {
  constructor(
    readonly type: FileType,
    readonly content: Buffer,
    readonly originalFileName: string,
  ) {}
}

// The consumer needs no mapping
for (const file of files) {
  const request = new UploadRequest(file.type, expirationDate);
  repository.upload(file, request);
}
```

### Branded Types for Primitive Identifiers

Use branded types to make identifiers self-descriptive and prevent accidental swaps:

```typescript
type TenantId = string & { readonly __brand: 'TenantId' };
type LandlordId = string & { readonly __brand: 'LandlordId' };

// ❌ Compile-time error: cannot pass TenantId where LandlordId expected
function getReceipts(landlordId: LandlordId): Receipt[] { ... }
getReceipts(tenantId); // Type error!

// Factory function
function toTenantId(id: string): TenantId {
  return id as TenantId;
}
```

> **See also**: `ts-conventions` for more on branded types and type safety patterns.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Tell Don't Ask | The object exposes behavior, not data to interpret |
| Collection > named properties | Same nature + same treatment = indexed collection |
| Whole Object | Pass the entire object, not its extracted primitives |
| `Symbol.iterator` | Make iterable, keep internals private |
| Self-descriptive value object | Include type/identity in the object |
| Branded types | Prevent primitive type confusion at compile time |
