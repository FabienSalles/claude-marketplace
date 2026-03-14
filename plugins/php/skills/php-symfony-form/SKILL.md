---
name: php-symfony-form
description: This skill should be used when working with Symfony forms, FormTypes, data_class, DataTransformers, or form options. Provides conventions for designing clean, well-structured Symfony forms.
version: "1.0"
---

# Symfony Form Conventions

## 1. The `data_class` Is the Single Source of Truth

**All form data must flow through the `data_class`**, not through options.

Options configure the form type **behavior** (labels, choices, validation rules), not transport data.

### Problem

```php
// ❌ AVOID - Data passed as options
$this->formFactory->create(IdentityDocumentType::class, $data, [
    'customer_birth_date' => $birthDate,
    'existing_files' => $existingFiles,
]);

// In configureOptions:
$resolver->setRequired('customer_birth_date');
$resolver->setRequired('existing_files');
```

### Solution

```php
// ✅ CORRECT - Everything is in the data_class
$this->formFactory->create(IdentityDocumentType::class, new IdentityDocument(
    customerBirthDate: $birthDate,
    existingFiles: $existingFiles,
));

// The FormType accesses data via $options['data']
public function buildForm(FormBuilderInterface $builder, array $options): void
{
    $identityDocument = $options['data'];
    $existingFiles = $identityDocument->existingFiles;
}
```

### Benefits

- The form type needs no custom options → **zero-option form**
- Event listeners no longer need parameters captured by the closure
- The factory only creates the data object, not the form itself

## 2. DataTransformer to Convert Form Objects to Model Objects

**The conversion between Symfony's native form objects and application model objects belongs in a DataTransformer**, not in the controller.

The controller must only manipulate model objects, never form-internal types.

### Problem

```php
// ❌ AVOID - Conversion in the controller
foreach ($fieldNames as $fieldName) {
    $file = $formData->getFileByFieldName($fieldName);

    if ($file instanceof UploadedFile) {
        $uploadFile = new UploadFile(
            file_get_contents($file->getPathname()),
            $file->getClientOriginalName(),
        );
    }
}
```

### Solution

```php
// ✅ CORRECT - DataTransformer in the FormType
$builder->get($fieldName)->addModelTransformer(new CallbackTransformer(
    static fn (): mixed => null,
    static fn (?UploadedFile $file): ?UploadFile => $file instanceof UploadedFile
        ? new UploadFile(
            file_get_contents($file->getPathname()),
            $file->getClientOriginalName(),
        )
        : null,
));

// The controller only manipulates model objects
foreach ($formData->getUploadFiles() as $file) {
    // $file is already a model object
}
```

## 3. `property_path` for Non-Standard Mappings

**Use `property_path` to map multiple fields to an indexed collection**, instead of creating a getter/setter per field.

### Problem

```php
// ❌ AVOID - One property per file
final class FormData
{
    private ?UploadedFile $frontFile = null;
    private ?UploadedFile $backFile = null;
    private ?UploadedFile $passportFile = null;

    public function getFrontFile(): ?UploadedFile { ... }
    public function setFrontFile(?UploadedFile $file): void { ... }
    // ... x3 getters/setters
}
```

### Solution

```php
// ✅ CORRECT - A collection with property_path
final class FormData
{
    private array $uploadFiles = [];

    public function getUploadFiles(): array { return $this->uploadFiles; }
    public function setUploadFiles(array $files): void { ... }
}

// In the FormType:
foreach (FieldName::ALL as $fieldName) {
    $builder->add($fieldName, FileUploadType::class, [
        'property_path' => sprintf('uploadFiles[%s]', $fieldName),
    ]);
}
```

## Quick Reference

| Rule | Principle |
|------|-----------|
| Data → `data_class` | Never in form type options |
| Form → model conversion | DataTransformer, not the controller |
| N fields → 1 collection | `property_path` to an indexed array |
| Zero-option form | If the `data_class` carries everything, no custom options |
