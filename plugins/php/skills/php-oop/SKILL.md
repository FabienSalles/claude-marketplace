---
name: php-oop
description: This skill should be used when designing classes, value objects, collections, or refactoring object-oriented code. Provides OOP design principles for clean, well-structured PHP code.
version: "1.0"
---

# OOP Design Principles

## 1. Tell Don't Ask

**The object that owns the data exposes the behavior.** Calling code must not extract data to make decisions on behalf of the object.

### Problem

```php
// ❌ AVOID - The controller queries the object and decides
$requiredFields = $identityDocument->getRequiredFieldNames();

foreach ($requiredFields as $fieldName) {
    $file = $identityDocument->getFileByFieldName($fieldName);

    if ($file !== null) {
        continue;
    }

    $existing = $existingFiles->find($fieldName);

    if ($existing === null) {
        continue;
    }

    // ... re-download logic
}
```

### Solution

```php
// ✅ CORRECT - The object exposes behavior
foreach ($identityDocument->getMissingExistingFiles() as $fieldName => $existingFile) {
    // The object already determined which files are missing
}
```

## 2. Collection Over Separate Named Properties

**When elements share the same nature and undergo the same processing**, prefer an indexed collection over separate named properties.

### Problem

```php
// ❌ AVOID - Separate properties = N identical code paths
final class FormData
{
    private ?File $frontFile = null;
    private ?File $backFile = null;
    private ?File $passportFile = null;

    public function getFileByFieldName(string $name): ?File
    {
        return match ($name) {
            'front_file' => $this->frontFile,
            'back_file' => $this->backFile,
            'passport_file' => $this->passportFile,
        };
    }
}
```

### Solution

```php
// ✅ CORRECT - One collection, one loop
final class FormData
{
    /** @param array<string, File> $files */
    private array $files = [];

    public function addFile(string $fieldName, File $file): void
    {
        $this->files[$fieldName] = $file;
    }

    public function getFiles(): array
    {
        return $this->files;
    }
}
```

**Criterion:** if elements share the same type and undergo the same processing (upload, validation, display), use a collection, even if the count is known and fixed.

## 3. Whole Object — Pass the Entire Object Instead of Its Primitives

**When multiple parameters come from the same object, pass the object.** Extracting primitives on the caller side is a sign of *feature envy*.

### Problem

```php
// ❌ AVOID - The caller destructures the object
$collection->add(
    documentType: $document->type,
    documentName: $document->originalFileName,
    downloadUrl: $url,
);
```

### Solution

```php
// ✅ CORRECT - The object is passed as a whole
$collection->addFromDocument(
    document: $document,
    downloadUrl: $url,
);
```

The receiving method extracts what it needs itself. This encapsulates the knowledge of `$document`'s structure.

## 4. Iterable Collections (`IteratorAggregate`)

**Implement `IteratorAggregate` when the collection will be iterated**, to keep the internal property private while allowing `foreach`.

### Problem

```php
// ❌ AVOID - Public property to allow iteration
final class FilesCollection
{
    public array $files = [];
}

// Direct access to internal array
foreach ($collection->files as $name => $file) { ... }
$collection->files[$name] = $file; // uncontrolled mutation
```

### Solution

```php
// ✅ CORRECT - Iterable with private property
/** @implements \IteratorAggregate<string, FileInfo> */
final class FilesCollection implements \IteratorAggregate
{
    /** @param array<string, FileInfo> $files */
    public function __construct(
        private array $files = [],
    ) {
    }

    public function add(string $name, FileInfo $file): void
    {
        $this->files[$name] = $file;
    }

    /** @return \ArrayIterator<string, FileInfo> */
    public function getIterator(): \ArrayIterator
    {
        return new \ArrayIterator($this->files);
    }
}

// Clean usage
foreach ($collection as $name => $file) { ... }
```

## 5. Self-Describing Value Objects

**Include the type or identity in the value object** so that consumers do not need external mappings to interpret it.

### Problem

```php
// ❌ AVOID - The consumer needs an external mapping
final class UploadFile
{
    public function __construct(
        public readonly string $content,
        public readonly string $originalFileName,
    ) {
    }
}

// The controller must maintain a fieldName → fileType mapping
foreach ($fileTypeMapping as $fieldName => $fileType) {
    $request = new UploadRequest($fileType, $expirationDate);
    $repository->upload($files[$fieldName], $request);
}
```

### Solution

```php
// ✅ CORRECT - The object carries its own type
final class UploadFile
{
    public function __construct(
        public readonly FileTypeEnum $type,
        public readonly string $content,
        public readonly string $originalFileName,
    ) {
    }
}

// The consumer needs no mapping
foreach ($files as $file) {
    $request = new UploadRequest($file->type, $expirationDate);
    $repository->upload($file, $request);
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
