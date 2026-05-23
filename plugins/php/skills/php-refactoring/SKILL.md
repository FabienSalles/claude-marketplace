---
name: php-refactoring
description: "ACTIVATE when refactoring PHP code. ACTIVATE for 'refactor', 'extract', 'redesign', 'simplify', or 'clean up' in a PHP/Symfony context. This skill provides PHP-specific examples for the cross-language refactoring rules defined in craft:refactoring-principles. DO NOT use for: writing new features from scratch (see phpunit:php-tdd-workflow), general OOP principles (see php-oop)."
version: "2.0"
---

# Refactoring — PHP Examples

> The **rules** are defined in `craft:refactoring-principles` (cross-language). This skill provides PHP / Symfony examples only. Load both for the full picture.

## Example — Rule 1: Trace the Complete Business Flow

```php
// ❌ AVOID — refactoring a controller without understanding the full flow
$uploadFile = new UploadFile($content, $fileName);

// ...but UploadFile is also created in downloadExistingFiles() with
// different data. Two inconsistent creation paths.
//
// Sources you must identify BEFORE refactoring:
//   - form upload:  UploadedFile (Symfony) → UploadFile
//   - API download: binary content        → UploadFile
//
// → The abstraction must unify both sources.
```

## Example — Rule 2: Consumer-Driven Value Object

```php
// ❌ AVOID — VO defined only from its creation point
final class UploadFile
{
    public function __construct(
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}

// Later, a consumer needs the file type → external mapping required.
//   repository->upload($file, $request)
//     uses  $file->content, $file->originalFileName, $request->fileType
//   → fileType comes from the file itself, NOT the request.

// ✅ CORRECT — include FileTypeEnum because a consumer needs it
final class UploadFile
{
    public function __construct(
        public readonly FileTypeEnum $type,
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}
```

## Example — Rule 3: Imports as a Coupling Signal

```php
// ❌ AVOID — controller importing a form-internal type
use Symfony\Component\HttpFoundation\File\UploadedFile;

// The controller manipulates UploadedFile (form-internal) instead of
// model objects. The import betrays a leaking abstraction.

// ✅ CORRECT — the controller imports a model
use App\Model\UploadFile;

// The controller only manipulates model objects.
// UploadedFile → UploadFile conversion happens in the FormType
// (via a DataTransformer).
```
