# DDD Functional Pattern Examples

> `Result`, `isSuccess`, `isFailure`, `pipe`, and `chain` used throughout these examples are the ones defined in `ts-functional` — this file does not redefine them. Success and failure values are constructed with `success(value)` / `failure(value)`, the constructors `ts-functional` defines; `isSuccess(result)` narrows to the success(...) arm, `isFailure(result)` to the failure(...) arm.

## Table of Contents
- [Aggregate Operations](#aggregate-operations)
- [Composing Operations with pipe](#composing-operations-with-pipe)
- [Smart Constructor Examples](#smart-constructor-examples)
- [Validation Pipeline Examples](#validation-pipeline-examples)
- [Enrichment Pipeline Examples](#enrichment-pipeline-examples)
- [Handler Pattern Examples](#handler-pattern-examples)
- [Nested Immutable Updates](#nested-immutable-updates)

## Aggregate Operations

Each operation is a curried function that returns a new aggregate (or a Result):

```typescript
// Pure transformation (no side effects)
const updateName =
  (name: { firstName: string; lastName: string }) =>
  (tenant: Tenant): Tenant => ({
    ...tenant,
    firstName: name.firstName,
    lastName: name.lastName,
    updatedAt: new Date(),
  });

// Fallible transformation
const addBillingAddress =
  (address: Address, existingCount: number) =>
  (tenant: Tenant): Result<Tenant, DomainError> => {
    if (existingCount >= MAX_ADDRESSES) {
      return failure({ message: 'Maximum addresses reached' });
    }

    return success({
      ...tenant,
      addresses: {
        ...tenant.addresses,
        billing: address,
        collection: [...tenant.addresses.collection, address],
      },
    });
  };
```

## Composing Operations with pipe

### Pure operations

```typescript
const applyUpdateCommand =
  (command: UpdateTenantCommand) =>
  (tenant: Tenant): Tenant =>
    pipe(
      tenant,
      updateName({ firstName: command.firstName, lastName: command.lastName }),
      updateContactInfo({ email: command.email, phone: command.phone }),
      updatePersonalInfo({ birthdate: command.birthdate }),
    );
```

### Fallible operations with chain

```typescript
const addFullAddress =
  (address: Address, addressCount: number) =>
  (tenant: Tenant): Result<Tenant, DomainError> =>
    pipe(
      tenant,
      addAddress(address),
      chain(addBillingAddress(address, addressCount)),
      chain(addShippingAddress(address, addressCount)),
    );
```

## Smart Constructor Examples

```typescript
// make + context => specialized function
const makeAddress =
  (addressId: string, createdAt: Date) =>
  (command: AddAddressCommand): Result<Address, DomainError> =>
    success({
      id: addressId,
      street: command.street,
      city: command.city,
      countryCode: command.countryCode,
      createdAt,
      updatedAt: createdAt,
    });

const makeFormatter =
  (logger: Logger) =>
  (rawMessage: ExternalMessage): Result<CreateTenantCommand, DomainError> => {
    logger.info('Formatting message', { id: rawMessage.id });
    return success({
      email: rawMessage.email,
      firstName: rawMessage.firstName,
      lastName: rawMessage.lastName,
    });
  };
```

### Usage in pipe

```typescript
// The smart constructor integrates naturally into a pipeline
const addressResult: Result<Address, DomainError> = pipe(
  addAddressCommand,
  validateBrazilAddress,
  chain(validateMexicoAddress),
  chain(validateUsaAddress),
  chain(makeAddress(addressId, createdAt)),  // Smart constructor at end of pipeline
);

if (isSuccess(addressResult)) {
  return addressResult.value;
}
```

## Validation Pipeline Examples

```typescript
type Validator<T> = (input: T) => Result<T, DomainError>;

const validatePeriod: Validator<CreateReceiptCommand> = (cmd) =>
  cmd.period.month < 1 || cmd.period.month > 12
    ? failure({ message: 'Invalid month' })
    : success(cmd);

const validateAmount: Validator<CreateReceiptCommand> = (cmd) =>
  cmd.amount <= 0
    ? failure({ message: 'Amount must be positive' })
    : success(cmd);

const validateLease: Validator<CreateReceiptCommand> = (cmd) =>
  cmd.leaseId === ''
    ? failure({ message: 'Lease ID required' })
    : success(cmd);

// Composition: stops at first error
const validateCreateReceipt = (cmd: CreateReceiptCommand): Result<CreateReceiptCommand, DomainError> =>
  pipe(
    cmd,
    validatePeriod,
    chain(validateAmount),
    chain(validateLease),
  );
```

## Enrichment Pipeline Examples

```typescript
type Enricher<T> = (input: T) => Result<T, DomainError>;

// Each enricher adds or transforms an aspect
const enrichWithCivility =
  (externalData: ExternalMessage) =>
  (command: CreateTenantCommand): Result<CreateTenantCommand, DomainError> => {
    const civility = mapCivility(externalData.civility);

    if (civility === null) {
      return failure({ message: `Unknown civility: ${externalData.civility}` });
    }

    return success({ ...command, civility });
  };

const enrichWithPhone =
  (externalData: ExternalMessage) =>
  (command: CreateTenantCommand): Result<CreateTenantCommand, DomainError> =>
    externalData.phone != null
      ? success({ ...command, phone: parsePhone(externalData.phone) })
      : success(command);

// Complete pipeline
const formatExternalToCommand =
  (externalData: ExternalMessage): Result<CreateTenantCommand, DomainError> =>
    pipe(
      buildBaseCommand(externalData),
      enrichWithCivility(externalData),
      chain(enrichWithPhone(externalData)),
      chain(enrichWithAddress(externalData)),
      chain(enrichWithBirthdate(externalData)),
    );
```

### Enrichment vs Validation

| Aspect | Validation | Enrichment |
|--------|-----------|------------|
| Purpose | Verify constraints | Transform / complete data |
| Input = Output type | Yes (`T -> Result<T, E>`) | Sometimes (`T -> Result<T, E>` or `A -> Result<B, E>`) |
| Source | Internal data (domain) | External data (API, message broker) |
| Position | Before business logic | At system boundary |

## Handler Pattern Examples

```typescript
const createReceiptHandler =
  (
    receiptRepository: ReceiptRepository,
    leaseRepository: LeaseRepository,
    idGenerator: IdGenerator,
  ) =>
  async (command: CreateReceiptCommand): AsyncResult<Receipt, DomainError> => {
    // 1. Validate
    const validated = validateCreateReceipt(command);

    if (isFailure(validated)) {
      return validated;
    }

    // 2. Load aggregate
    const lease = await leaseRepository.getById(command.leaseId);

    if (isFailure(lease)) {
      return lease;
    }

    // 3. Domain logic (pure)
    const receipt = createReceipt(idGenerator.generate(), validated.value, lease.value);

    if (isFailure(receipt)) {
      return receipt;
    }

    // 4. Persist
    await receiptRepository.save(receipt.value);
    return receipt;
  };
```

## Nested Immutable Updates

For deeply nested structures, progressive spread maintains immutability:

```typescript
const updateBillingAddress =
  (address: Address) =>
  (tenant: Tenant): Tenant => ({
    ...tenant,
    addresses: {
      ...tenant.addresses,
      billing: address,
      billingId: address.id,
    },
    updatedAt: new Date(),
  });

// Update within a collection
const removeAddress =
  (addressId: string) =>
  (tenant: Tenant): Tenant => ({
    ...tenant,
    addresses: {
      ...tenant.addresses,
      collection: tenant.addresses.collection.filter(a => a.id !== addressId),
    },
  });
```
