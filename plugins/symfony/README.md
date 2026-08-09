# symfony

Personal Symfony conventions extracted from the original monolithic `php` plugin so a user on Laravel, Drupal, or a pure-PHP library can install [`php`](../php/) without dragging in Symfony-specific overlays they don't need.

## Install

```text
/plugin install symfony@fabien-claude-marketplace
```

## Skills (5)

| Skill | Purpose |
|---|---|
| [`symfony-frontend`](skills/symfony-frontend/SKILL.md) | Where frontend behaviour lives in a Symfony project: no inline `<script>`/`<style>` in Twig, one WebpackEncore entry per feature, per-page asset loading, SCSS imported by its JS module, `js-*` hooks added at render time. |
| [`symfony-form`](skills/symfony-form/SKILL.md) | FormType design: `data_class` as single source of truth (no data in options), `DataTransformer` placement (not in controllers), `property_path` for collection mapping. |
| [`twig-conventions`](skills/twig-conventions/SKILL.md) | Twig template + Twig component conventions: `trans_default_domain` isolation (1 translation → inline `domain:`, 2+ → hoist `trans_default_domain`), `ClockInterface` for dates in templates, decision rules for "should I create a Twig component vs use direct HTML". |
| [`prg-pattern`](skills/prg-pattern/SKILL.md) | Post/Redirect/Get pattern for HTML form controllers: POST success → redirect (302), POST error → re-render with errors and submitted data, flash messages after redirect. _Examples use Symfony classes (`RedirectResponse`, `UrlGeneratorInterface`, `getFlashBag()`, `#[Route]`); the pattern itself applies to any PHP web framework._ |
| [`symfony-test-conventions`](skills/symfony-test-conventions/SKILL.md) | Testing anything that boots a Symfony kernel: picking the cheapest base class, built-in `WebTestCase` assertions over hand-rolled crawler reads (`assertSelectorTextContains`, `assertResponseRedirects`, `assertCheckboxChecked`…), one-dataset-one-test for HTML pages, full-JSON assertion for API endpoints, `TypeTestCase` for FormTypes, and container-double traps (`disableReboot`, one `set()` per service). |

## Distinct from `symfony@atournayre-claude-plugin-marketplace`

`atournayre/symfony` is Antoine Tournayre's broader Symfony toolkit (general Symfony conventions). This `symfony` plugin is a **personal overlay** with a tighter scope: three specific conventions the author wanted strictly enforced (form data ownership, Twig component translation domain isolation, PRG discipline).

Use them in parallel: they don't overlap on the same surfaces.

## Recommended companion plugins

- [`php`](../php/): the PHP language conventions. Required pairing, since the FormType / Twig / PRG examples assume modern PHP idioms (readonly classes, typed constants, nullsafe operator).
- [`phpunit`](../phpunit/): testing discipline for the code these conventions produce.
- [`craft`](../craft/): cross-language principles. `symfony-form` defers to `craft:ddd-principles` for the data ownership rationale; `prg-pattern` defers to `craft:oop-principles` for the controller-as-coordinator framing.

## See also

- [`twig-conventions`](skills/twig-conventions/SKILL.md) explicitly cross-links to [`symfony-form`](skills/symfony-form/SKILL.md) for the form-data-class rule. If you install one without the other, the cross-link dangles (still useful, just not clickable).
