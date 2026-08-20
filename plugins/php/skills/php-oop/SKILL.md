---
name: php-oop
description: "ACTIVATE when designing PHP classes, value objects, collections, or when the user asks about object design, encapsulation, or 'Tell Don't Ask' in PHP. Provides PHP-specific examples for the cross-language OOP rules defined in craft:oop-principles, plus PHP-specific patterns (readonly properties, IteratorAggregate). DO NOT use for: refactoring methodology (see php-refactoring), DDD domain modeling (see php-ddd-conventions)."
version: "2.0"
---

# OOP — PHP Examples

> The **rules** are defined in `craft:oop-principles`. This skill provides PHP / Symfony examples plus PHP-specific patterns.

## Example — Rule 1: Tell Don't Ask

```php
// ❌ AVOID — caller queries and decides
foreach ($identityDocument->getRequiredFieldNames() as $fieldName) {
    $file = $identityDocument->getFileByFieldName($fieldName);
    if ($file !== null) { continue; }
    // ... re-download logic
}

// ✅ CORRECT — object exposes behavior
foreach ($identityDocument->getMissingExistingFiles() as $fieldName => $existingFile) {
    // Object already determined which files are missing
}
```

## Example — Rule 2: Collection Over Named Properties

```php
// ❌ AVOID — N separate properties = N identical code paths
final class FormData {
    private ?File $frontFile = null;
    private ?File $backFile = null;
    private ?File $passportFile = null;
}

// ✅ CORRECT — one keyed collection
final class FormData {
    /** @param array<string, File> $files */
    private array $files = [];
    public function addFile(string $fieldName, File $file): void { /* ... */ }
}
```

## Example — Rule 3: Whole Object

```php
// ❌ AVOID — caller destructures
$collection->add(
    documentType: $document->type,
    documentName: $document->originalFileName,
    downloadUrl: $url,
);

// ✅ CORRECT — pass the whole object
$collection->addFromDocument($document, $url);
```

## Example — Rule 4: Iterable Collections via `IteratorAggregate`

PHP-specific: implement `IteratorAggregate` to allow `foreach` while keeping internals private.

```php
/** @implements \IteratorAggregate<string, FileInfo> */
final class FilesCollection implements \IteratorAggregate
{
    public function __construct(private array $files = []) {}

    public function add(string $name, FileInfo $file): void
    {
        $this->files[$name] = $file;
    }

    public function getIterator(): \ArrayIterator
    {
        return new \ArrayIterator($this->files);
    }
}

// Usage: foreach ($collection as $name => $file) { ... }
```

## Example — Rule 5: Self-Describing Value Object

```php
// ❌ AVOID — consumer needs external fieldName → fileType mapping
final class UploadFile {
    public function __construct(
        public string $content,
        public string $originalFileName,
    ) {}
}

// ✅ CORRECT — object carries its own type
final readonly class UploadFile {
    public function __construct(
        public FileTypeEnum $type,
        public string $content,
        public string $originalFileName,
    ) {}
}
```

Readonly placement (per-property vs class-level) is `php-8-2`'s call, not this skill's.
