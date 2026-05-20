---
name: oop-principles
description: "ACTIVATE when designing classes, value objects, collections, or when the user asks about object design, encapsulation, or 'Tell Don't Ask' across languages. Covers cross-language OOP principles: Tell Don't Ask, collection over named properties, Whole Object pattern, iterable collections, self-describing value objects. Language-specific examples and constructs (IteratorAggregate, Symbol.iterator, branded types) live in companion skills (php-oop, ts-oop)."
version: "1.0"
---

# OOP Design — Cross-Language Principles

> The **rules** below are language-agnostic. Concrete syntax-specific examples live in:
> - `php-oop` (PHP — `IteratorAggregate`, readonly properties)
> - `ts-oop` (TypeScript — `Symbol.iterator`, branded types)

These principles focus on patterns where Claude tends to produce "ask" code instead of "tell" code.

## 1. Tell Don't Ask

The object that owns the data exposes the behavior. Do **not** extract data to make decisions externally.

**Smell:** caller queries `obj.getX()`, applies a condition, then calls back into the object.

**Fix:** push the condition into the object — expose a method that already encodes the decision (`obj.getMissingX()`, `obj.canDoY()`).

**Criterion:** if the same `if/match` on object state appears in multiple call sites, the object should own it.

## 2. Collection Over Separate Named Properties

When elements share the same type and undergo the same processing, use an indexed collection — **even if the count is known and fixed**.

**Smell:** `$frontFile`, `$backFile`, `$passportFile` (or `frontFile`, `backFile`, `passportFile`) with parallel handling code.

**Fix:** a single keyed collection (`Map<string, File>`, `array<string, File>`) with one loop.

**Criterion:** same nature + same treatment (upload, validation, display) = collection.

## 3. Whole Object — Pass the Object, Not Its Primitives

When multiple parameters come from the same object, pass the **object**. Extracting primitives on the caller side is feature envy.

**Smell:** `add(documentType: doc.type, documentName: doc.originalFileName, downloadUrl: url)` — three properties of `doc` destructured.

**Fix:** `addFromDocument(doc, url)` — let the receiver extract what it needs.

**Criterion:** if a call site reads ≥ 2 properties of the same object to pass them along, pass the object.

## 4. Iterable Collections with Private Internals

When a collection will be iterated, expose iteration **without** exposing the underlying array. The language provides a protocol for this (PHP: `IteratorAggregate`, TS: `Symbol.iterator`, Python: `__iter__`, …).

**Smell:** public property holding the underlying array, allowing `coll.files.push(...)`.

**Fix:** keep the array private, implement the language's iteration protocol so `for ... of coll` (or equivalent) works.

**Criterion:** if a caller iterates the collection, it must not be able to mutate it directly.

## 5. Self-Describing Value Objects

Include the type / identity **in** the value object so consumers don't need an external mapping to interpret it.

**Smell:** `{ content, originalFileName }` + a separate `fieldName → fileType` mapping kept by the consumer.

**Fix:** add the `type` (or other discriminator) **inside** the value object — `{ type, content, originalFileName }`.

**Criterion:** if a consumer needs an external lookup to know what kind of value object it received, the type is missing from the object.

## Quick Reference

| Rule | Principle |
|------|-----------|
| Tell Don't Ask | The object exposes behavior, not data to interpret |
| Collection > named properties | Same nature + same processing = indexed collection |
| Whole Object | Pass the entire object, not its extracted primitives |
| Iterable + private | Use the language's iteration protocol, keep internals private |
| Self-describing VO | Include type/identity in the object — no external mapping |
