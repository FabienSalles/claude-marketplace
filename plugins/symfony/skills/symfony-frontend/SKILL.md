---
name: symfony-frontend
description: "ACTIVATE when adding or modifying frontend behaviour in a Symfony project — any new feature whose Twig template would otherwise contain `<script>` / `<style>` blocks, or any new JS/CSS file that needs to be loaded for a specific page. ACTIVATE for 'inline script in twig', 'inline style in twig', 'WebpackEncore', 'addEntry', 'encore_entry_link_tags', 'encore_entry_script_tags', 'where to put my JS', 'how to load CSS for one page', 'FormType injecting class', 'js- hook in template'. Covers: forbidden inline `<script>`/`<style>` in Twig, one Encore entry per feature, per-page asset loading via `{% block stylesheets %}` + `{% block javascripts %}` extending parent, SCSS imported by the JS module (one entry bundles both), FormType stays domain/server (no CSS-only classes via `attr`), `js-*` hooks added in the template at render time. DO NOT use for: jQuery code style (see jquery:jquery), generic Twig conventions (see symfony:twig-conventions), generic FormType conventions (see symfony:symfony-form)."
version: "1.0"
---

# Symfony Frontend Organization

> Where JS, CSS and Twig live in a Symfony project, and how they connect through Webpack Encore. The **code style** of the JS itself (jQuery patterns, selectors) is covered by `jquery:jquery` — this skill only covers the *organization*.

## Rule 1 — No `<script>` or `<style>` in Twig

Twig templates carry **markup and translation**. JS lives in `.js` files, CSS in `.scss` files. Always.

```twig
{# ❌ Inline JS #}
{% block body %}
    <button id="trigger">Toggle</button>
    <script>document.getElementById('trigger').addEventListener('click', () => { /* … */ });</script>
{% endblock %}

{# ❌ Inline CSS #}
{% block body %}
    <style>.my-class { background: white; }</style>
{% endblock %}
```

```twig
{# ✅ #}
{% block stylesheets %}
    {{ parent() }}
    {{ encore_entry_link_tags('my-feature') }}
{% endblock %}

{% block javascripts %}
    {{ parent() }}
    {{ encore_entry_script_tags('my-feature') }}
{% endblock %}

{% block body %}
    <button class="js-trigger">Toggle</button>
{% endblock %}
```

**Why**: inline blocks aren't bundled, aren't minified, aren't cacheable, can't share imports, run at parse time (before DOM ready), and bury logic where it can't be grepped.

## Rule 2 — One Encore Entry per Feature

Each feature has its own `addEntry` in `webpack.config.js`:

```js
Encore
    // …
    .addEntry('main', './assets/main.js')                                          // global
    .addEntry('suitability', './assets/features/proposal/suitability.js')          // per page
    .addEntry('my-feature', './assets/features/proposal/my-feature.js')            // per page
```

**Naming**: kebab-case, matches the feature, not the page name (the same feature might be used on multiple pages later).

**File location**: `assets/features/<bounded-context>/<feature>.js`. Mirror the backend's bounded contexts when possible (`assets/features/proposal/...`, `assets/features/customer/...`).

## Rule 3 — SCSS Imported by the JS Module

The JS module imports its own SCSS at the top. Encore bundles both into the same entry's `link_tags` / `script_tags`.

```js
// assets/features/proposal/my-feature.js
import './my-feature.scss';

export const initMyFeature = () => { /* … */ };

$(document).ready(() => initMyFeature());
```

```scss
/* assets/features/proposal/my-feature.scss */
.js-my-feature-block textarea[readonly] {
    background-color: #fff;
}
```

**Don't**: dump feature CSS in `assets/main.scss`. That file is for **global** rules (resets, design-system overrides, utilities used everywhere). Feature CSS stays with its feature.

## Rule 4 — `{% block stylesheets %}` / `{% block javascripts %}` Always Extend Parent

The base template often loads global bundles (`main`, theme-bundle, etc.). A per-page template **adds** its entry — never replaces.

```twig
{# ✅ #}
{% block stylesheets %}
    {{ parent() }}
    {{ encore_entry_link_tags('my-feature') }}
{% endblock %}
```

```twig
{# ❌ Forgets {{ parent() }} — base CSS is lost on this page #}
{% block stylesheets %}
    {{ encore_entry_link_tags('my-feature') }}
{% endblock %}
```

## Rule 5 — `js-*` Hooks Added in the Template, Not in the FormType

The FormType describes the **domain shape** of the form (types, options, constraints). It must not inject CSS-only or JS-only classes via `attr` — those are **presentation concerns** that belong to the template.

```php
// ❌ FormType polluted by frontend concerns
->add('proposal_context', TextareaType::class, [
    'attr' => [
        'readonly' => true,
        'class' => 'js-my-feature-textarea',  // CSS hook injected server-side
    ],
])
```

```php
// ✅ FormType stays domain-oriented
->add('proposal_context', TextareaType::class, [
    'attr' => ['readonly' => true],
])
```

```twig
{# Template adds the JS hook at render time #}
{{ form_widget(form.proposal_context, {attr: {class: 'js-my-feature-textarea'}}) }}
```

**Why**: the FormType is reused (rendered into different templates, tested in isolation). Coupling it to a specific CSS class means every test, every reuse, every refactor of the styling carries the FormType along. Keep the seam clean.

`readonly` is **semantic** (the form is sometimes read-only) — that belongs in the FormType. `js-*` is **presentational** (this rendering uses JS) — that belongs in the template.

## Rule 6 — CSS Targets the `js-*` Wrapper, Not FormType-Generated Classes

A CSS rule must never depend on a class auto-injected by Symfony Forms (e.g. `.form-control`, `.is-invalid`) or by your FormType's `attr`. Target the **wrapper** the template added, plus a generic element/state.

```scss
/* ✅ */
.js-my-feature-block textarea[readonly] {
    background-color: #fff;
}
```

```scss
/* ❌ Fragile if FormType options change */
.commercial-proposal__textarea {
    background-color: #fff;
}
```

For one-rule features, the `js-*` wrapper class **doubles as the CSS hook**. Splitting into a separate styling class is over-engineering.

Specificity reminder: `.js-foo-block textarea[readonly]` is `(0, 2, 1)`, beating Bootstrap's `.form-control[readonly]` `(0, 2, 0)`. No `!important` needed.

## Checklist When Adding a Per-Page Feature

- [ ] JS file under `assets/features/<context>/<feature>.js`
- [ ] SCSS file under `assets/features/<context>/<feature>.scss`, imported by the JS file
- [ ] New `.addEntry('<feature>', './assets/features/<context>/<feature>.js')` in `webpack.config.js`
- [ ] Per-page Twig template extends `{% block stylesheets %}` and `{% block javascripts %}` with the entry tags, both with `{{ parent() }}` first
- [ ] No `<script>` or `<style>` block in the template
- [ ] No `class: 'js-…'` in the FormType `attr` — added at render time in the template
- [ ] CSS rule targets the `js-*` wrapper + a generic element/state, never a FormType-generated class

## Quick Reference

| Situation                                  | Approach                                                                   |
|--------------------------------------------|----------------------------------------------------------------------------|
| Need JS on a page                          | Module under `assets/features/<context>/<feature>.js`, new Encore entry    |
| Need CSS for one feature                   | `.scss` next to the JS, `import './feature.scss'` from the JS              |
| Load assets for one page                   | `{% block stylesheets %}` + `{% block javascripts %}`, extend `parent()`   |
| Need a CSS class for styling on a field    | Add via the template (`form_widget(..., {attr: {class: 'js-foo'}}`)        |
| Need a CSS class for JS hooking            | Same — never via the FormType `attr`                                       |
| Want to share styles across the whole app  | `assets/main.scss`                                                         |
| Want to share styles across one feature    | Feature `.scss`, imported by the feature module                            |
| jQuery code style for the module itself    | See `jquery:jquery` skill                                                  |
