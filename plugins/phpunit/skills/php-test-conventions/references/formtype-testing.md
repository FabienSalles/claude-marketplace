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
