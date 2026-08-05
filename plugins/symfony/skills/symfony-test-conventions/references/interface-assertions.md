# Interface assertions — use the built-ins before the crawler

`WebTestCase` ships a full assertion vocabulary through `WebTestAssertionsTrait`
(`BrowserKitAssertionsTrait` + `DomCrawlerAssertionsTrait`). Most hand-rolled crawler
plumbing has a one-line equivalent that reads better **and** fails better.

## Why it matters beyond style

A built-in assertion is not just shorter. It carries the selector and the expected value into
the failure message, and it bundles the checks you would otherwise forget:

- `assertSelectorTextContains('.alert-success', '…')` asserts **selector exists** *and* text
  matches. The hand-rolled `$crawler->filter('.alert-success')->text()` throws
  `InvalidArgumentException: The current node list is empty.` when the element is missing —
  an *error*, not a *failure*, with no mention of what was expected.
- `assertSelectorTextSame` already runs `trim()` **and** whitespace normalization on the node
  text, so `trim($crawler->filter(…)->text())` is redundant work you got right by accident.
- `assertResponseRedirects('/path')` asserts 3xx **and** `Location`. Reading
  `$response->headers->get('Location')` yourself passes on a 200 that happens to carry the
  header.

## The catalogue

### Response and routing

| Instead of | Use |
|---|---|
| `assertSame(200, $client->getResponse()->getStatusCode())` | `assertResponseIsSuccessful()` |
| `assertResponseStatusCodeSame(422)` | `assertResponseIsUnprocessable()` |
| `assertSame(302, …)` + reading the `Location` header | `assertResponseRedirects('/expected/path')` — optional 2nd arg pins the code |
| `assertSame('app_route', $request->attributes->get('_route'))` | `assertRouteSame('app_route', ['id' => 42])` |
| Reading `$response->headers->get('Content-Type')` | `assertResponseHeaderSame('content-type', 'text/html; charset=UTF-8')` / `assertResponseFormatSame('html')` |
| Digging into the response cookie bag | `assertResponseHasCookie(…)`, `assertResponseCookieValueSame(…)`, `assertBrowserHasCookie(…)`, `assertBrowserCookieValueSame(…)` |

`assertResponseStatusCodeSame()` stays the right call for a code with no dedicated helper
(`403`, `404`, `409`…).

### Content

| Instead of | Use |
|---|---|
| `assertStringContainsString('X', $crawler->filter('.sel')->text())` | `assertSelectorTextContains('.sel', 'X')` |
| `assertSame('X', trim($crawler->filter('.sel')->text()))` | `assertSelectorTextSame('.sel', 'X')` |
| `assertStringNotContainsString('X', $crawler->filter('.sel')->text())` | `assertSelectorTextNotContains('.sel', 'X')` |
| `assertCount(1, $crawler->filter('.sel'))` | `assertSelectorCount(1, '.sel')` |
| `assertGreaterThan(0, $crawler->filter('.sel')->count())` | `assertSelectorExists('.sel')` |
| `assertCount(0, $crawler->filter('.sel'))` | `assertSelectorNotExists('.sel')` |
| `assertSame('Titre', $crawler->filter('title')->text())` | `assertPageTitleSame('Titre')` / `assertPageTitleContains(…)` |

**First node, not all of them.** `assertSelectorTextContains` and `assertSelectorTextSame`
read the text of the **first** matching node. When the expected text may be on any one of
several matches, use `assertAnySelectorTextContains` / `assertAnySelectorTextSame` /
`assertAnySelectorTextNotContains`.

### Form state

| Instead of | Use |
|---|---|
| `assertSame('Eres', $crawler->filter('input[name="f[employer]"]')->attr('value'))` | `assertInputValueSame('f[employer]', 'Eres')` |
| `assertNotNull($crawler->filter('input[type="radio"]')->attr('checked'))` | `assertCheckboxChecked('f[ownership]')` |
| `assertNull(…->attr('checked'))` | `assertCheckboxNotChecked('f[ownership]')` |
| Rebuilding the form to read one value | `assertFormValue('form[name="f"]', 'f[country]', 'FR')` — resolves selects and radios through the real `Form` object |

`assertCheckboxChecked()` / `assertInputValueSame()` take an **exact** field name, injected
into `input[name="…"]`. For a suffix or partial match, drop to
`assertSelectorExists('input[name$="[ownership]"]:checked')`, which is still a built-in.

### Mail

`assertEmailCount`, `assertQueuedEmailCount`, `assertEmailIsQueued`, `assertEmailSubjectContains`,
`assertEmailAddressContains`, `assertEmailHtmlBodyContains`, `assertEmailTextBodyContains`,
`assertEmailAttachmentCount`, `assertEmailHeaderSame` — via `MailerAssertionsTrait`. Never
pull the message out of the profiler by hand.

## Where the crawler is still right

The built-ins always query the **whole document**. Keep a crawler when the assertion is
scoped to a sub-tree you have to locate first:

```php
// Legitimate — the assertion is about the 3rd row, not about the page
$rows = $crawler->filter('.account-row');
self::assertStringContainsString('M. Jean Dupont', $rows->eq(2)->text());
```

Same for iterating nodes, reading an arbitrary attribute with no dedicated helper, or
following a link. The rule is not "never touch the crawler" — it is **do not hand-roll an
assertion that already exists**.

## Worked example

```php
// ❌ Before — a crawler variable, a manual trim, and an error (not a failure) when absent
$crawler = $this->client->followRedirect();

self::assertSame(
    'Votre déclaration a bien été enregistrée.',
    trim($crawler->filter('.alert-success')->text()),
);

// ✅ After — the assertion names the selector and the expectation, and the
//    crawler variable disappears because nothing else needed it
$this->client->followRedirect();

self::assertSelectorTextContains('.alert-success', 'Votre déclaration a bien été enregistrée.');
```

`assertSelectorTextContains` reads the client's **last** response, so it works after
`followRedirect()`, `submit()` or `click()` without threading a crawler through the test.

## Trap: `followRedirect()` and container doubles

`KernelBrowser` reboots the kernel between requests, which discards every double installed
with `self::getContainer()->set(…)`. A test that submits and then follows the redirect
re-issues a GET against the **real** services and blows up somewhere unrelated. Call
`$this->client->disableReboot()` before the submission, in that test only.

```php
$this->stubSaveDeclaration();
$this->client->disableReboot();

$this->submitForm([...]);
$this->client->followRedirect();

self::assertSelectorTextContains('.alert-success', '…');
```
