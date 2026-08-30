---
name: ts-ports-adapters
description: "ACTIVATE when a container-less TypeScript codebase needs to isolate a domain from an external dependency (database, HTTP client, filesystem, clock). ACTIVATE for 'port', 'adapter', 'hexagonal', 'dependency inversion', 'without a container'. Covers: declaring a port as a type, building an adapter that implements it, composing the adapter at an infrastructure entry point, substituting a test double for the same port. DO NOT use for: aggregate modeling (see ddd-ts-fp), Result/error handling (see ts-functional), Tell Don't Ask and collections (see ts-oop)."
version: "1.0"
---

# Ports & Adapters Without a Container

## The Port

**A port is the shape the domain depends on, declared as a type** -- not an interface bound by a container, not a class the domain extends:

```typescript
type PaymentPort = {
  charge(amount: number, customerId: string): Promise<Result<ChargeReceipt, ChargeError>>;
};
```

> See ts-functional for `Result<T, E>` -- a port's fallible operations return it rather than throwing.

## The Adapter

**An adapter is a plain object literal that satisfies the port**, wrapping the concrete dependency:

```typescript
function makeStripePaymentAdapter(stripeClient: Stripe): PaymentPort {
  return {
    async charge(amount, customerId) {
      try {
        const intent = await stripeClient.paymentIntents.create({ amount, customer: customerId });
        return success({ receiptId: intent.id, amount });
      } catch (error) {
        return failure({ reason: 'charge-declined', cause: error });
      }
    },
  };
}
```

## Composition

**The adapter is built once, at the infrastructure entry point of the application, and passed down as an argument** -- no container resolves it, no decorator registers it:

```typescript
// infrastructure/composition-root.ts
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
const paymentPort: PaymentPort = makeStripePaymentAdapter(stripeClient);

const checkoutService = makeCheckoutService(paymentPort);
```

`makeCheckoutService` never imports `Stripe`. It only ever sees `PaymentPort`.

## The Substitution That Proves It Pays

**Swap the adapter for a test double built from the same port, with no change to the domain code under test:**

```typescript
function makeFakePaymentAdapter(outcome: Result<ChargeReceipt, ChargeError>): PaymentPort {
  return { charge: async () => outcome };
}

const checkoutService = makeCheckoutService(makeFakePaymentAdapter(success({ receiptId: 'test-1', amount: 100 })));
```

The domain compiles and runs against the fake exactly as it does against the Stripe adapter -- the port is what makes the swap possible, not a container.

> See ts-oop for Tell Don't Ask -- a port's methods are commands and queries on the dependency, not exposed state.
