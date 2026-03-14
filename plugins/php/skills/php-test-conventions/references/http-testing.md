# Testing API/HTTP Client Returns

**CRITICAL**: When testing code that deserializes API responses, always use a **real serializer** to catch deserialization issues.

## Test Naming for HTTP Clients

Name tests to reflect **both** the API call and the response processing:

```php
// ❌ Only describes deserialization
public function itDeserializesArrayOfProductsIntoResponse(): void

// ✅ Describes API call AND deserialization
public function itCallsApiAndDeserializesProductsResponse(): void
public function itCallsGetEndpointAndReturnsDeserializedResponse(): void
```

## HTTP Client Test Structure (Spy Pattern)

Follow AAA pattern with spy verification **after** the act:

```php
/** @test */
public function itCallsApiAndDeserializesProductsResponse(): void
{
    // Arrange - Setup stub response (use Argument::any() - no constraints here)
    $jsonResponse = '[{"uuid":"123","code":"ABC"}]';
    $httpClientFacade = $this->prophesize(HttpClientFacade::class);
    $httpClientFacade->jsonGet(Argument::any())->willReturn($jsonResponse);
    $httpClient = new GetProductsHttpClient(
        $httpClientFacade->reveal(),
        SerializerFactory::create(),
    );

    // Act
    $result = $httpClient->__invoke();

    // Assert - First verify result, then verify API was called with correct URL
    $expected = new GetProductsResponse([...]);
    self::assertEquals($expected, $result);
    $httpClientFacade->jsonGet('/api/v1/products')->shouldHaveBeenCalled();
}
```

Key points:
- **Stub** (`willReturn`): Use `Argument::any()` (single arg) or `Argument::cetera()` (multiple args) - only provides data
- **Spy** (`shouldHaveBeenCalled`): Verify exact URL/parameters **after** the act
- This separation ensures AAA pattern is respected: no assertions before act

## When to Use Which Approach

| Data format | Approach |
|-------------|----------|
| Simple arrays, scalars | `json_encode()` / `json_decode()` |
| DTOs, Response objects | Symfony Serializer |

## SerializerRegistry Pattern

For projects using Symfony Serializer, create a `SerializerRegistry` (or `SerializerTrait`) to provide a properly configured serializer:

```php
// tests/SerializerRegistry.php
namespace App\Tests;

use Symfony\Component\PropertyInfo\Extractor\ConstructorExtractor;
use Symfony\Component\PropertyInfo\Extractor\PhpDocExtractor;
use Symfony\Component\PropertyInfo\Extractor\ReflectionExtractor;
use Symfony\Component\PropertyInfo\PropertyInfoExtractor;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Serializer\Normalizer\JsonSerializableNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\SerializerInterface;

class SerializerRegistry
{
    private static ?SerializerInterface $serializer = null;

    public static function getSerializer(): SerializerInterface
    {
        if (self::$serializer === null) {
            $phpDocExtractor = new PhpDocExtractor();
            $extractors = [
                new ConstructorExtractor([$phpDocExtractor]),
                $phpDocExtractor,
                new ReflectionExtractor(),
            ];
            $propertyTypeExtractor = new PropertyInfoExtractor($extractors, $extractors);

            self::$serializer = new Serializer(
                [
                    new DateTimeNormalizer(),
                    new JsonSerializableNormalizer(),
                    new ObjectNormalizer(null, null, null, $propertyTypeExtractor),
                    new ArrayDenormalizer(),
                ],
                [new JsonEncoder()]
            );
        }

        return self::$serializer;
    }
}
```

### Usage in Tests

```php
use App\Tests\SerializerRegistry;

/** @test */
public function itDeserializesApiResponse(): void
{
    $jsonResponse = '[{"uuid":"123","name":"Test"}]';

    $httpClient = new MyHttpClient(
        $httpClientFacade->reveal(),
        SerializerRegistry::getSerializer(),  // Real serializer
    );

    $expected = new MyResponse([...]);

    self::assertEquals($expected, $httpClient->__invoke());
}
```

### Check Existing Registries

Before creating a new one, check if the project or its dependencies already have one:

```bash
# Search in project tests
grep -r "SerializerFactory\|SerializerRegistry\|SerializerTrait" tests/

# Search in acme packages (they often have one)
find vendor/acme -name "*Serializer*" -path "*/tests/*"
```
