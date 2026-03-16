---
name: php-sql-conventions
description: "ACTIVATE when writing SQL queries in PHP code, using Doctrine DBAL, or formatting database queries. ACTIVATE for 'SQL', 'query', 'DBAL', 'JOIN', 'SELECT'. Covers: query direction convention (start from known entity), nowdoc formatting for SQL, column listing, JOIN ordering. DO NOT use for: Doctrine ORM/DQL, database migrations, general PHP code conventions."
version: "1.1"
---

# SQL Conventions

Conventions for SQL queries written in PHP code (Doctrine DBAL).

## Query Direction

**IMPORTANT**: Always start queries from the known/main entity and navigate to related entities via JOINs.

### Principle

When you have access to a specific entity (via ID or UUID), start the query from that entity's table and JOIN towards the data you need.

### Example

**Context**: You have a `$orderId` and want to fetch associated buyers.

```php
// Start from orders (known entity) -> navigate to buyer
FROM orders o
INNER JOIN shipping_group sg ON sg.id = o.shipping_group_id
INNER JOIN shipping_item si ON si.shipping_group_id = sg.id
INNER JOIN buyer b ON b.id = si.buyer_id
WHERE o.id = :order_id

// Start from buyer (unknown) -> navigate back to orders
FROM buyer b
INNER JOIN shipping_item si ON si.buyer_id = b.id
INNER JOIN shipping_group sg ON sg.id = si.shipping_group_id
INNER JOIN orders o ON o.shipping_group_id = sg.id
WHERE o.id = :order_id
```

### Why This Matters

1. **Readability**: The query follows the logical path from what you know to what you need
2. **Intent clarity**: The starting table indicates the entry point of the query
3. **Consistency**: Easier to maintain when all queries follow the same pattern

## Nowdoc Formatting for SQL

**IMPORTANT**: Follow [PER Coding Style - Section 10](https://www.php-fig.org/per/coding-style/#10-heredoc-and-nowdoc) for nowdoc/heredoc formatting.

See **[code-conventions skill](../php-code-conventions/SKILL.md#heredoc-and-nowdoc-per-coding-style-section-10)** for complete PER rules.

### SQL-Specific Rules

1. **Always use nowdoc** (`<<<'SQL'`) - never heredoc (`<<<SQL`) for SQL queries
2. Use prepared statement parameters (`:param`) instead of variable interpolation

### Correct Format

```php
$data = $connection->executeQuery(
    <<<'SQL'
        SELECT b.id, b.name
        FROM buyer b
        WHERE b.uuid = :uuid
        SQL,
    [
        'uuid' => $uuid,
    ],
    [
        'uuid' => UuidType::NAME,
    ],
)->fetchAssociative();
```

## SELECT Formatting

### Column Listing

One column per line for readability:

```php
<<<'SQL'
    SELECT
        b.id,
        b.first_name,
        b.last_name,
        BIN_TO_UUID(b.uuid) as uuid
    FROM buyer b
    SQL
```

### Aliasing

- Use short, meaningful table aliases (`b` for buyer, `o` for orders)
- Always prefix columns with table alias when multiple tables are involved
- Use `AS` for column aliases: `BIN_TO_UUID(b.uuid) AS uuid`

## JOIN Conventions

### Order

1. Start with the main/known table in FROM
2. JOIN tables in logical order following relationships
3. Use explicit JOIN type (`INNER JOIN`, `LEFT JOIN`)

### Example

```php
FROM orders o
INNER JOIN shipping_group sg ON sg.id = o.shipping_group_id
INNER JOIN shipping_item si ON si.shipping_group_id = sg.id
LEFT JOIN buyer b ON b.id = si.buyer_id
```

## Quick Reference

| Rule | Description |
|------|-------------|
| Query direction | Start from known entity, JOIN to needed data |
| Nowdoc syntax | Use `<<<'SQL'` (nowdoc), never `<<<SQL` (heredoc) |
| Nowdoc format | See [code-conventions](../php-code-conventions/SKILL.md#heredoc-and-nowdoc-per-coding-style-section-10) for PER rules |
| Column listing | One per line for multi-column SELECT |
| Table aliases | Short, meaningful, always prefixed |
| JOIN order | Follow logical relationship path |
