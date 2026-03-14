---
name: php-twig-conventions
description: This skill should be used when working with Twig templates, Twig components (twig:*), translations in Twig, or when encountering translation issues. Provides conventions for Twig templating in Symfony projects.
version: "1.0"
---

# Twig Conventions

This skill documents important Twig conventions and common pitfalls to avoid in Symfony projects.

## Purpose

Prevent common mistakes when working with Twig templates, especially regarding translations and component isolation.

## Critical Concepts

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

Always specify the domain explicitly when translating inside Twig component content:

```twig
{% trans_default_domain 'my_domain' %}

<twig:Button>
    {{ 'my_key'|trans(domain: 'my_domain') }}  {# CORRECT: Explicit domain #}
</twig:Button>
```

#### Why This Happens

Twig components process their content in isolation. The `trans_default_domain` tag sets a variable in the current template scope, but component content is evaluated in a separate context where this variable is not accessible.

### Full Example

```twig
{% extends 'base.html.twig' %}

{% block body %}
    {% trans_default_domain 'order_checkout' %}

    {# Direct translation - uses trans_default_domain #}
    <h1>{{ 'title'|trans }}</h1>

    {# Inside a Twig component - MUST specify domain #}
    <div class="d-flex gap-3">
        <twig:Button href="{{ path('back_route') }}">
            {{ 'back_button'|trans(domain: 'order_checkout') }}
        </twig:Button>
        <twig:Button type="submit" color="primary">
            {{ 'continue_button'|trans(domain: 'order_checkout') }}
        </twig:Button>
    </div>
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

## When to Use Explicit Domain

Always use explicit `domain:` parameter when:

1. Translating text inside `<twig:*>` component tags
2. Translating text inside macros called from another file
3. Translating in any context that might have isolated scope

## Quick Reference

| Context | Inherits `trans_default_domain` | Solution |
|---------|--------------------------------|----------|
| Direct in template | Yes | `{{ 'key'\|trans }}` |
| Inside `<twig:Component>` | **No** | `{{ 'key'\|trans(domain: 'domain') }}` |
| Inside macro (same file) | Yes | `{{ 'key'\|trans }}` |
| Inside imported macro | Depends | Use explicit domain to be safe |

## Debugging Translation Issues

When a translation key appears as-is instead of translated:

1. **Check if you're inside a Twig component** - Add explicit domain
2. **Verify the domain name** - Check `translations/{domain}.{locale}.yaml` exists
3. **Check key path** - Nested keys use dot notation: `section.subsection.key`
4. **Clear cache** - Run `bin/console cache:clear`
