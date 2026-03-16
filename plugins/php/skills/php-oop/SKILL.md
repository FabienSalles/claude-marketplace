---
name: php-oop
description: "ACTIVATE when designing PHP classes, value objects, collections, or when the user asks about object design, encapsulation, or 'Tell Don't Ask'. Covers: Tell Don't Ask with concrete PHP examples, collection over named properties, Whole Object pattern, IteratorAggregate, self-describing value objects. DO NOT use for: refactoring methodology (see php-refactoring), DDD domain modeling (see php-ddd-conventions)."
version: "1.1"
---

# OOP Design Principles

Project-specific OOP conventions. These focus on patterns where Claude tends to produce "ask" code instead of "tell" code.

## 1. Tell Don't Ask

The object that owns the data exposes the behavior. Do not extract data to make decisions externally.

```php
// AVOID: caller queries and decides
foreach ($identityDocument->getRequiredFieldNames() as $fieldName) {
    $file = $identityDocument->getFileByFieldName($fieldName);
    if ($file !== null) { continue; }
    // ... re-download logic
}

// CORRECT: object exposes behavior
foreach ($identityDocument->getMissingExistingFiles() as $fieldName => $existingFile) {
    // Object already determined which files are missing
}
```

## 2. Collection Over Separate Named Properties

When elements share the same type and processing, use an indexed collection — even if the count is known and fixed.

```php
// AVOID: N separate properties = N identical code paths
final class FormData {
    private ?File $frontFile = null;
    private ?File $backFile = null;
    private ?File $passportFile = null;
}

// CORRECT: one collection
final class FormData {
    /** @param array<string, File> $files */
    private array $files = [];
    public function addFile(string $fieldName, File $file): void { ... }
}
```

## 3. Whole Object — Pass the Object, Not Its Primitives

When multiple parameters come from the same object, pass the object. Extracting primitives is feature envy.

```php
// AVOID: caller destructures
$collection->add(documentType: $document->type, documentName: $document->originalFileName, downloadUrl: $url);

// CORRECT: pass whole object
$collection->addFromDocument(document: $document, downloadUrl: $url);
```

## 4. Iterable Collections (`IteratorAggregate`)

Implement `IteratorAggregate` to allow `foreach` while keeping internals private.

```php
/** @implements \IteratorAggregate<string, FileInfo> */
final class FilesCollection implements \IteratorAggregate
{
    public function __construct(private array $files = []) {}

    public function add(string $name, FileInfo $file): void { $this->files[$name] = $file; }

    public function getIterator(): \ArrayIterator { return new \ArrayIterator($this->files); }
}

// Usage: foreach ($collection as $name => $file) { ... }
```

## 5. Self-Describing Value Objects

Include the type/identity in the value object so consumers need no external mapping.

```php
// AVOID: consumer needs external fieldName -> fileType mapping
final class UploadFile {
    public function __construct(
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}

// CORRECT: object carries its own type
final class UploadFile {
    public function __construct(
        public readonly FileTypeEnum $type,
        public readonly string $content,
        public readonly string $originalFileName,
    ) {}
}
```

## Quick Reference

| Rule | Principle |
|------|-----------|
| Tell Don't Ask | The object exposes behavior, not data to interpret |
| Collection > named properties | Same nature + same processing = indexed collection |
| Whole Object | Pass the entire object, not its extracted primitives |
| `IteratorAggregate` | Make iterable, keep internals private |
| Self-describing value object | Include type/identity in the object |
