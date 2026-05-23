---
name: php-twig-conventions
description: "ACTIVATE when writing or modifying Twig templates, using Twig components (twig:*), handling translations in Twig, debugging translation issues, or deciding whether to create a Twig component. ACTIVATE whenever 'trans_default_domain', 'twig component', 'translation not working', 'create twig component', or 'should I create a component' appears. Covers: trans_default_domain isolation in Twig components (1 translation = inline domain, 2+ translations = hoist trans_default_domain in the component scope), ClockInterface for dates in templates, when to create a Twig component vs use direct HTML. DO NOT use for: Twig syntax basics, Symfony controller rendering, generic CSS questions."
version: "1.3"
---

# Twig Conventions

Critical pitfalls and decision rules for Twig templates and components.

## Critical Concepts

### When to Create a Twig Component (`<twig:*>`)

A Twig component is only justified if it encapsulates **complex logic** — either in the component itself or in its PHP class. Use HTML directly otherwise.

#### Create a component when:
- Non-trivial rendering logic (multiple conditional branches, props transformations, slots)
- Business logic in the PHP class (calculations, services, computed state)
- Effective reuse in ≥ 2 independent templates with distinct callsites

#### Don't create a component when:
- It's just a wrapper around an HTML element with a CSS class
- The class is empty and the template is a single tag

```twig
{# WRONG — Twig component with no logic #}
<twig:Marker />
```

```twig
{# CORRECT — Direct HTML #}
<span class="marker"></span>
```

A component without logic adds overhead (YAML registration, PHP file, Twig file) for zero benefit. Raw HTML is more readable, faster to render, and easier to grep.

#### Decision checklist

Before creating `MyComponent.php` + `MyComponent.html.twig`, answer:
1. Will the PHP class have non-trivial methods or constructor dependencies? → if no, reconsider
2. Will the template have conditionals, loops, or computed values? → if no, reconsider
3. Will it be called from ≥ 2 places with different contexts? → if no, reconsider

If all three answers are "no", write inline HTML + class. You can always extract to a component later when the need emerges.

---

### Translation Domains in Twig Components

**IMPORTANT**: Twig components (`<twig:*>`) are isolated and do NOT inherit `trans_default_domain` from the parent template.

#### The Problem

When using `trans_default_domain` in a parent template, child content passed to a Twig component does NOT inherit this domain:

```twig
{# Parent template #}
{% trans_default_domain 'my_domain' %}

<twig:Button>
    {{ 'my_key'|trans }}  {# WRONG: Will look in 'messages' domain, not 'my_domain' #}
</twig:Button>
```

#### The Solution

There are two acceptable ways to set the domain inside a Twig component, depending on how many translations the component content holds.

##### Rule: 1 translation → inline `domain:`

When there is a single `|trans` call inside the component content, pass the domain inline. No need to add a setup line for one call.

```twig
<twig:Alert>
    <twig:block name="content">{{ 'warning'|trans(domain: 'my_domain') }}</twig:block>
</twig:Alert>
```

##### Rule: 2+ translations → hoist `{% trans_default_domain %}` once

When the component content contains 2+ `|trans` calls, declare `{% trans_default_domain %}` once at the top of the content rather than repeating `(domain: '...')` on every line. Repetition is a refactor liability — change the domain once and you've shifted N spots.

```twig
<twig:Table>
    {% trans_default_domain 'my_domain' %}
    <thead>
        <tr>
            <th>{{ 'col.name'|trans }}</th>
            <th>{{ 'col.type'|trans }}</th>
            <th>{{ 'col.isin'|trans }}</th>
            <th>{{ 'col.sri'|trans }}</th>
            <th>{{ 'col.allocation'|trans }}</th>
        </tr>
    </thead>
    {# ... #}
</twig:Table>
```

The `trans_default_domain` declared inside the component's content scope applies within that isolated scope.

#### Why This Happens

Twig components process their content in isolation. The `trans_default_domain` tag sets a variable in the current template scope, but component content is evaluated in a separate context where the **parent**'s variable is not accessible. Re-declaring `trans_default_domain` *inside* the component content sets it in that inner scope.

### Full Example

```twig
{% extends 'base.html.twig' %}

{% block body %}
    {% trans_default_domain 'order_checkout' %}

    {# Direct translation in template scope — inherits trans_default_domain #}
    <h1>{{ 'title'|trans }}</h1>

    {# 1 translation inside a component — inline domain #}
    <twig:Alert>
        <twig:block name="content">{{ 'warning'|trans(domain: 'order_checkout') }}</twig:block>
    </twig:Alert>

    {# 2+ translations inside a component — hoist trans_default_domain #}
    <twig:Table>
        {% trans_default_domain 'order_checkout' %}
        <thead>
            <tr>
                <th>{{ 'col.name'|trans }}</th>
                <th>{{ 'col.qty'|trans }}</th>
                <th>{{ 'col.price'|trans }}</th>
            </tr>
        </thead>
    </twig:Table>
{% endblock %}
```

---

## Dates and Time Values in Templates

**IMPORTANT**: Never use Twig date functions directly in templates. Inject a `ClockInterface` (PSR-20) via a Twig component, a controller, or a Twig function/extension.

### The Problem

```twig
{# WRONG: Global function in the template #}
<footer>Acme {{ "now"|date("Y") }}</footer>
```

**Issues:**
- Not testable (impossible to mock the date)
- Tight coupling with global functions

### Solutions

#### Option 1: Via a Twig component

```php
// src/Twig/Component/Layout.php
final class Layout
{
    public function __construct(private readonly ClockInterface $clock) {}

    public function getCurrentYear(): string
    {
        return $this->clock->now()->format('Y');
    }
}
```

```twig
<footer>Acme {{ this.currentYear }}</footer>
```

#### Option 2: Via the controller

```php
// In the controller
return $this->render('template.html.twig', [
    'currentYear' => $this->clock->now()->format('Y'),
]);
```

```twig
<footer>Acme {{ currentYear }}</footer>
```

#### Option 3: Via a Twig function/extension

```php
// src/Twig/Extension/DateExtension.php
final class DateExtension extends AbstractExtension
{
    public function __construct(private readonly ClockInterface $clock) {}

    public function getFunctions(): array
    {
        return [
            new TwigFunction('current_year', [$this, 'getCurrentYear']),
        ];
    }

    public function getCurrentYear(): string
    {
        return $this->clock->now()->format('Y');
    }
}
```

```twig
<footer>Acme {{ current_year() }}</footer>
```

### Benefits

- **Testability**: Mockable clock in tests
- **PSR-20**: Standard interface (`Psr\Clock\ClockInterface`)
- **Decoupling**: No dependency on global functions

## When to Set the Domain Explicitly

The parent's `trans_default_domain` does not propagate into:

1. `<twig:*>` component content
2. Macros called from another file (imported macros)
3. Any isolated rendering scope

Pick the form based on call count:

- **1 translation in the isolated scope** → inline `(domain: '...')`
- **2+ translations in the isolated scope** → declare `{% trans_default_domain '...' %}` once at the top of that scope

## Quick Reference

| Context | Inherits parent `trans_default_domain` | 1 translation | 2+ translations |
|---------|---------------------------------------|---------------|-----------------|
| Direct in template | Yes | `{{ 'key'\|trans }}` | `{{ 'key'\|trans }}` |
| Inside `<twig:Component>` | **No** | `{{ 'key'\|trans(domain: 'd') }}` | `{% trans_default_domain 'd' %}` then `{{ 'key'\|trans }}` |
| Inside macro (same file) | Yes | `{{ 'key'\|trans }}` | `{{ 'key'\|trans }}` |
| Inside imported macro | Depends | `{{ 'key'\|trans(domain: 'd') }}` | `{% trans_default_domain 'd' %}` then `{{ 'key'\|trans }}` |

## Debugging Translation Issues

When a translation key appears as-is instead of translated:

1. **Check if you're inside a Twig component** - Add explicit domain
2. **Verify the domain name** - Check `translations/{domain}.{locale}.yaml` exists
3. **Check key path** - Nested keys use dot notation: `section.subsection.key`
4. **Clear cache** - Run `bin/console cache:clear`
