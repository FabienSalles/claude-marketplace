# Test Doubles Strategy

## 1. Manual Stubs (Preferred)

Use manual stubs when the class is simple:

```php
public function buyerWith100PercentProfileIsEligible(): void
{
    $specification = new IsBuyerEligibleForDiscount();

    $profileCompletion = new ProfileCompletion();
    $profileCompletion->setPercentage(100);

    $profile = new Profile();
    $profile->setProfileCompletion($profileCompletion);

    $buyer = new Buyer();
    $buyer->setProfile($profile);

    self::assertTrue($specification->isSatisfiedBy($buyer));
}
```

## 2. Prophecy (For Complex Dependencies)

Use Prophecy when manual stubs are too complex or when the class has little reuse value:

```php
use Prophecy\PhpUnit\ProphecyTrait;

public function expectToCallApiToCreateOrder(): void
{
    $httpClientFacade = $this->prophesize(HttpClientFacade::class);
    $serializer = $this->prophesize(SerializerInterface::class);
    $logger = $this->prophesize(LoggerInterface::class);

    $request = CreateOrderRequestFactory::createFull();
    $jsonResponse = '{"uuid": "..."}';

    $httpClientFacade->jsonPost('/api/v1/orders', $request)->willReturn($jsonResponse);
    $serializer->deserialize($jsonResponse, OrderCreateResponse::class, 'json')
        ->willReturn(new OrderCreateResponse());

    $sut = new CreateOrderHttpClient(
        $httpClientFacade->reveal(),
        $serializer->reveal(),
        $logger->reveal(),
    );

    $sut->__invoke($request);

    $httpClientFacade->jsonPost('/api/v1/orders', $request)->shouldHaveBeenCalled();
}
```

## Prophecy Best Practices: Permissive Arrange, Strict Assert

When testing with Prophecy, **stay permissive in arrange** (stubs) and **strict in assert** (spies).

**IMPORTANT**: A stub's role is to provide data, not to verify parameters. Never use `Argument::type()` or specific values in stubs:

- **`Argument::any()`** : single parameter (more readable)
- **`Argument::cetera()`** : multiple parameters

```php
// ❌ Wrong - stub is verifying parameters (that's a spy's job)
private function stubRepository(): void
{
    $repository = $this->prophesize(Repository::class);
    $repository->get(Argument::type(Uuid::class))->willReturn($data);
    $repository->save(
        Argument::type(Uuid::class),
        Argument::type('string'),
        Argument::type(Request::class),
    )->willReturn($response);
}

// ✅ Correct - stub only provides data, no parameter verification
private function stubRepository(): void
{
    $repository = $this->prophesize(Repository::class);
    $repository->get(Argument::any())->willReturn($data);        // single param → any()
    $repository->save(Argument::cetera())->willReturn($response); // multiple params → cetera()
}
```

**Full example**:

```php
/** @test */
public function itPrefillsFormWithCreditCardData(): void
{
    // Arrange - Permissive: use Argument::cetera() for stubs
    $paymentMethodRepository = $this->prophesize(PaymentMethodRepository::class);
    $paymentMethodRepository->get(Argument::cetera())
        ->willReturn(BuyerPaymentMethodResponseFactory::createWithCreditCard());

    $formFactory = $this->prophesize(FormFactoryInterface::class);
    $formFactory->create(Argument::cetera())
        ->willReturn($this->prophesize(FormInterface::class)->reveal());

    $sut = new PaymentMethodFormFactory(
        $formFactory->reveal(),
        $paymentMethodRepository->reveal(),
    );

    // Act
    $sut->create(
        new OrderBuyerUuid(self::BUYER_UUID, self::ORDER_UUID),
        new \DateTimeImmutable('1980-01-15'),
    );

    // Assert - Strict: use Argument::that() with PHPUnit assertions inside
    $formFactory->create(
        Argument::any(),
        Argument::that(function (array $formData): bool {
            self::assertEquals([
                'payment_type' => PaymentMethodTypeEnum::CREDIT_CARD->value,
                'expiration_date' => new \DateTimeImmutable('2030-06-15'),
            ], $formData);

            return true;
        }),
        Argument::any(),
    )->shouldHaveBeenCalled();
}
```

**Key benefits:**

1. **`Argument::cetera()` in arrange**: Don't over-constrain stubs. They just provide data.

2. **`Argument::that()` with assertions in assert**: Use PHPUnit assertions inside the callback for clear error messages:
   ```php
   Argument::that(function ($data): bool {
       self::assertEquals($expected, $data);  // Clear diff on failure
       return true;
   })
   ```

3. **`assertEquals` with array/object**: Group multiple values in a single assertion:
   ```php
   // ❌ Multiple assertions - harder to read error messages
   self::assertSame('credit_card', $formData['payment_type']);
   self::assertEquals(new \DateTimeImmutable('2030-06-15'), $formData['expiration_date']);

   // ✅ Single assertion with grouped values - clear diff on failure
   self::assertEquals([
       'payment_type' => 'credit_card',
       'expiration_date' => new \DateTimeImmutable('2030-06-15'),
   ], $formData);
   ```

   When test fails, PHPUnit shows a complete diff:
   ```
   Failed asserting that Array (
       'payment_type' => 'credit_card'
       'expiration_date' => 2030-01-01
   ) is equal to Array (
       'payment_type' => 'credit_card'
       'expiration_date' => 2030-06-15
   ).
   ```

## 3. Guzzle MockHandler (For HTTP Clients)

For API endpoint tests, prefer Guzzle MockHandler or its testing trait:

```php
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;

public function expectToReturnOrderSummary(): void
{
    $mockHandler = new MockHandler([
        new Response(200, [], '{"uuid": "abc-123", "status": "in_progress"}'),
    ]);

    $handlerStack = HandlerStack::create($mockHandler);
    $client = new Client(['handler' => $handlerStack]);

    $httpClientFacade = new HttpClientFacade($client, ...);
    $repository = new OrderHttpClientRepository($httpClientFacade, $serializer);

    $result = $repository->getSummary('abc-123');

    self::assertSame('abc-123', $result->getUuid());
}
```
