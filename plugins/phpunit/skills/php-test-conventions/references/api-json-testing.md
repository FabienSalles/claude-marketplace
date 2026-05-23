# API Functional Tests — Assert the Full JSON Response

## Rule

For functional tests (`WebTestCase`) on API endpoints where all data is deterministic (fixtures with hardcoded values), **assert the full JSON response directly** with `assertJsonStringEqualsJsonString` and a JSON heredoc.

## Why?

- **Contract documentation**: The test IS the API contract — readable by anyone
- **Single assertion**: One comparison instead of dozens of partial checks
- **Clear diff**: PHPUnit shows exactly what differs between expected and actual JSON
- **No decoding overhead**: No `json_decode` + array navigation + multiple `assertContains`

## Examples

```php
// ❌ Avoid: decode + multiple partial assertions
$data = json_decode($this->client->getResponse()->getContent(), true);
self::assertArrayHasKey('products', $data);
self::assertContains('perp', array_column($data['products'], 'code'));
self::assertSame('PERP', $data['products'][0]['name']);
self::assertArrayNotHasKey('id', $data['products'][0]);

// ❌ Avoid: json_encode a PHP array — adds unnecessary indirection
self::assertJsonStringEqualsJsonString(
    json_encode(['products' => [['code' => 'perp', 'name' => 'PERP']]]),
    $this->client->getResponse()->getContent(),
);

// ✅ Correct: assert the raw JSON directly via heredoc
self::assertJsonStringEqualsJsonString(
    <<<'JSON'
        {
            "products": [
                {"code": "perp", "name": "PERP"}
            ],
            "institutions": [
                {"code": "allianz_vie", "name": "ALLIANZ VIE", "products": ["83", "perp"]}
            ],
            "services": [
                {"code": "allianz_gestion", "name": "ALLIANZ Gestion", "institutionCode": "allianz_vie", "products": ["perp"]}
            ]
        }
        JSON,
    $this->client->getResponse()->getContent(),
);
```

## When to Use

All response values are controlled by fixtures (codes, names, flags). No generated IDs, dates, or non-deterministic values.

## When NOT to Use

Response contains generated UUIDs, timestamps, or any value not controlled by the test. In that case, decode and assert on stable fields only.
