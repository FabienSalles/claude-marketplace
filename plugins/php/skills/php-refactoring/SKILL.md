---
name: php-refactoring
description: "ACTIVATE when the user wants to refactor, redesign, extract classes/value objects, or restructure PHP code. ACTIVATE for 'refactor', 'extract', 'redesign', 'simplify', or 'clean up' requests. Covers: mandatory end-to-end flow analysis before refactoring, consumer-driven value object design, imports as coupling signals. DO NOT use for: writing new features from scratch (see php-tdd-workflow), general OOP principles (see php-oop)."
version: "1.1"
---

# Refactoring Methodology

## 1. Trace the Complete Business Flow BEFORE Refactoring

A local refactoring that ignores the global flow produces incomplete abstractions. Before touching any code, trace the data flow end-to-end.

### Problem

```php
// ❌ AVOID - Refactoring a controller without understanding the full flow
// UploadFile is created in the controller...
$uploadFile = new UploadFile($content, $fileName);

// ...but the same object is also created
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
//   - an uploaded file (form → UploadedFile → UploadFile)
//   - an existing re-downloaded file (API → binary content → UploadFile)
// → The abstraction must unify both sources
```

**Criterion:** if an object can be constructed from N different sources, the refactoring must identify all of them before defining the structure.

## 2. Design by Tracing All Consumers

**When creating or modifying a value object, list all its consumers to define the required properties.** Do not limit the analysis to the creation point.

### Problem

```php
// ❌ AVOID - Defining a value object only from its creation point
final class UploadFile
{
    public function __construct(
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}

// Later, a consumer needs the file type...
// A missing property is discovered.
// The consumer must maintain an external mapping.
```

### Solution

```php
// ✅ CORRECT - Analyze consumers before defining the structure
//
// Steps:
// 1. List every place that CONSUMES the object
// 2. For each consumer, note the data it needs
// 3. Include in the object everything consumers extract
//
// Consumer: repository->upload($file, $request)
//   → needs $file->content, $file->originalFileName
//   → needs $request->fileType (comes from the file)
//
// → The type must be carried by UploadFile itself

final class UploadFile
{
    public function __construct(
        public readonly FileTypeEnum $type,
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}
```

**Criterion:** a value object is complete when no consumer needs an external mapping to interpret it.

## 3. Imports as a Coupling Signal

**A file's imports reveal its real dependencies.** After a refactoring, verify that remaining imports are consistent with the class responsibility.

### Problem

```php
// ❌ AVOID - A controller importing form-internal types
use Symfony\Component\HttpFoundation\File\UploadedFile;

// This controller manipulates UploadedFile (form-internal type)
// instead of model objects.
// The import betrays a leaking abstraction.
```

### Solution

```php
// ✅ CORRECT - The import reflects the right abstraction level
use App\Model\UploadFile;

// The controller only manipulates model objects.
// The UploadedFile → UploadFile conversion is done in the FormType
// (via a DataTransformer).
//
// Post-refactoring check:
// 1. List the imports of the modified file
// 2. Does each import belong to this class's responsibility?
// 3. A "foreign" import signals misplaced responsibility
```

**Criterion:** after a refactoring, if a file imports a type that does not match its layer/responsibility, code needs to be moved.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Complete business flow | Trace all sources and destinations before refactoring |
| Trace consumers | List all usages to define a value object's structure |
| Imports = coupling | Imports reveal dependencies; verify their consistency |
