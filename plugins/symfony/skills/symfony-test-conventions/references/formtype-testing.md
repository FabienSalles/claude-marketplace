# Testing Symfony FormTypes

**IMPORTANT**: Always use `Symfony\Component\Form\Test\TypeTestCase` for testing FormTypes.

```php
use Symfony\Component\Form\Extension\Validator\ValidatorExtension;
use Symfony\Component\Form\Test\TypeTestCase;
use Symfony\Component\Validator\Validation;

final class MyFormTypeTest extends TypeTestCase
{
    protected function getExtensions(): array
    {
        return [
            new ValidatorExtension(Validation::createValidator()),
        ];
    }

    protected function getTypes(): array
    {
        // Register custom form types with their dependencies
        return [
            new MyFormType($dependency1, $dependency2),
        ];
    }

    /** @test */
    public function formSubmitsValidData(): void
    {
        $form = $this->factory->create(MyFormType::class, null, [
            'option' => 'value',
        ]);

        $form->submit(['field' => 'value']);

        self::assertTrue($form->isSynchronized());
        self::assertCount(0, $form->getErrors(true));
    }
}
```

Key points:
- `getExtensions()`: Add form extensions (ValidatorExtension for validation)
- `getTypes()`: Register custom form types with mocked dependencies
- Use `$this->factory` (provided by TypeTestCase) to create forms

## Asserting Validation Errors (Invalid Submissions)

When a submission is expected to be **invalid**, assert the error on the **field
that owns the rule** — `$form->get('field')->getErrors()` — not just the deep count
`$form->getErrors(true)`. That couples the test to *which* field is flagged (the
perceivable behaviour), and `assertCount(1, ...)` is more precise than
`assertGreaterThanOrEqual(1, ...)`. Skip the redundant `isSubmitted()`/`isValid()`
asserts: exactly one error on the right field already proves invalidity.

Always pass a **readable failure message** built from the actual error messages, via
a `formatErrors()` helper — otherwise a failure prints an opaque
`Failed asserting that 0 is identical to 1` with no clue what went wrong.

```php
/**
 * @test
 * @dataProvider provideInvalidSubmissions
 */
public function formIsInvalid(array $options, array $submitted, array $errorPath): void
{
    $form = $this->factory->create(MyFormType::class, null, $options);

    $form->submit($submitted);

    $field = $form;
    foreach ($errorPath as $key) {
        $field = $field->get($key);
    }
    $errors = $field->getErrors();

    self::assertCount(1, $errors, sprintf('Expected one validation error but got: %s', $this->formatErrors($errors)));
}

public static function provideInvalidSubmissions(): \Generator
{
    yield 'no bank account' => [
        'options' => [],
        'submitted' => ['accounts' => []],
        'errorPath' => ['accounts'],                 // top-level field
    ];

    yield 'professional structure checked without a SIRET' => [
        'options' => ['with_professional_structure' => true],
        'submitted' => [/* … account_ownership=professional, siret='' … */],
        'errorPath' => ['professional', 'siret'],    // nested sub-form field
    ];
}

/** @param iterable<\Symfony\Component\Form\FormError> $errors */
private function formatErrors(iterable $errors): string
{
    $messages = [];

    foreach ($errors as $error) {
        $messages[] = $error->getMessage();
    }

    return implode(', ', $messages);
}
```

**Make the error land on the field, not the form root.** `$form->get('field')->getErrors()`
only sees errors attached to that node — `getErrors()` is not deep, and `getErrors(true)`
collects *descendants*, never *ancestors*. A constraint on a **compound** field
(`CollectionType`, expanded `EnumType`/`ChoiceType`) bubbles to the root by default
(`error_bubbling` defaults to the field's `compound` value), so its error would land on
`$form`, not the field. Two ways to keep it on the field:

- Set `'error_bubbling' => false` on that field (also the better UX — the error renders
  at the control, not at the top of the form).
- Or add the error directly in a `POST_SUBMIT` listener with
  `$form->get('field')->addError(new FormError($message))` — this places it exactly where
  you choose and needs no `error_bubbling` tweak.

Simple (non-compound) fields (`TextType`, …) already keep their errors, so nested
sub-form fields like `professional.siret` need no change.
