# Anti-patterns

Common jQuery mistakes that look reasonable but break in production. Each entry: the bad version, the rewrite, the reason.

## 1. Inline `<script>` in templates

```html
<!-- ❌ -->
<div class="card">…</div>
<script>
    document.querySelector('.card .btn').addEventListener('click', () => { /* … */ });
</script>
```

**Why it's bad**: not bundled, not minified, can't share state with other modules, runs immediately (the DOM may not be ready), pollutes the template with logic.

**Rewrite**: extract to a module file, register an Encore (or your bundler's) entry, include the script tag via the template's `{% block javascripts %}`.

## 2. Vanilla `querySelectorAll` mixed with jQuery

```js
// ❌
document.querySelectorAll('.js-trigger').forEach(btn => {
    btn.addEventListener('click', () => $(btn).closest('.js-block').addClass('is-open'));
});
```

**Why it's bad**: two APIs on the same element, broken chainability, inconsistent event delegation semantics.

**Rewrite**: pick one. In a jQuery codebase, use jQuery throughout:

```js
$('.js-trigger').on('click', function () {
    $(this).closest('.js-block').addClass('is-open');
});
```

## 3. Hardcoded server-generated IDs

```js
// ❌
$('#commercial_proposal_form_proposal_context').removeAttr('readonly');
```

**Why it's bad**: the ID changes if the parent form name changes, if the field is wrapped, if Symfony's `name` strategy is reconfigured. Fragile, and the dependency is invisible from the FormType.

**Rewrite**: add a `js-*` class on the field in the template, target that (for the Symfony FormType/Twig split, see `symfony:symfony-frontend`):

```js
$('.js-proposal-context-textarea').removeAttr('readonly');
```

## 4. `data-*` as a JS hook

```html
<!-- ❌ -->
<button data-action="edit" data-target="#context">Edit</button>
```

```js
$('[data-action="edit"]').on('click', () => { /* … */ });
```

**Why it's bad**: conflates intent ("hook") with state ("currently editing"). Hard to grep — `[data-action]` is too generic and matches unrelated patterns.

**Rewrite**: `js-*` class for hooks, `data-*` reserved for state:

```html
<button class="js-edit-trigger" data-target="context">Edit</button>
```

```js
$('.js-edit-trigger').on('click', function () {
    const target = $(this).data('target'); // state ok in data-*
});
```

## 5. `addClass`/`removeClass` pair where `toggleClass` works

```js
// ❌
const swapButtons = ($shown, $hidden) => {
    $shown.addClass('d-none');
    $hidden.removeClass('d-none');
};
$editButton.on('click', () => swapButtons($editButton, $resetButton));
$resetButton.on('click', () => swapButtons($resetButton, $editButton));
```

**Why it's bad**: encodes "which to hide, which to show" in two places. Adds a helper with no real value.

**Rewrite**: single `toggleClass` on the set:

```js
const $buttons = $block.find(`${EDIT_SELECTOR}, ${RESET_SELECTOR}`);
$editButton.on('click', () => $buttons.toggleClass('d-none'));
$resetButton.on('click', () => $buttons.toggleClass('d-none'));
```

The two handlers stay because they do different things to the textarea. The visibility toggle is the same in both.

## 6. Capturing original value lazily in `data-*`

```js
// ❌
$editButton.on('click', () => {
    if ($textarea.data('original') === undefined) {
        $textarea.data('original', $textarea.val());
    }
    $textarea.removeAttr('readonly');
});

$resetButton.on('click', () => {
    $textarea.val($textarea.data('original') ?? $textarea.val());
    $textarea.attr('readonly', 'readonly');
});
```

**Why it's bad**: races on first click (what if Reset is clicked before Edit?), pollutes the DOM with state that belongs to the closure, needs defensive coding.

**Rewrite**: capture at init time:

```js
const originalValue = $textarea.val();
$editButton.on('click', () => $textarea.removeAttr('readonly'));
$resetButton.on('click', () => $textarea.val(originalValue).attr('readonly', 'readonly'));
```

## 7. Global `$(document).on(…)` for handlers in static DOM

```js
// ❌ Event delegation when nothing is dynamic
$(document).on('click', '.js-trigger', function () {
    $(this).closest('.js-block').find('.js-content').toggleClass('d-none');
});
```

**Why it's bad**: every click anywhere on the document is checked against the selector. Slower, harder to read, doesn't communicate that nothing is dynamic.

**Rewrite**: direct binding when the DOM is static:

```js
$('.js-block').each(function () {
    const $block = $(this);
    const $trigger = $block.find('.js-trigger');
    const $content = $block.find('.js-content');

    $trigger.on('click', () => $content.toggleClass('d-none'));
});
```

Reserve delegation for content that's actually mutated after init (AJAX-loaded, collection types, etc.).

## 8. CSS class injected by server-side form, used by JS

```php
// ❌ FormType injecting a CSS class
->add('field', TextareaType::class, [
    'attr' => ['class' => 'my-feature-textarea'],
])
```

```js
$('.my-feature-textarea').removeAttr('readonly');
```

**Why it's bad**: the FormType (server-side, domain-oriented) ends up dictating CSS hooks. Frontend and backend coupling that's invisible from the JS side.

**Rewrite**: keep the FormType lean. Add the `js-*` class in the **template** at render time:

```twig
{{ form_widget(form.field, {attr: {class: 'js-my-feature-textarea'}}) }}
```

Or wrap the rendered widget in a `.js-*` parent and target inside.

## 9. Mixing presentation classes with JS hooks

```html
<!-- ❌ -->
<button class="btn btn-primary js-modify">…</button>
```

```js
$('.btn-primary').on('click', () => { /* breaks the next time someone restyles */ });
```

**Why it's bad**: refactoring the styling class breaks the JS.

**Rewrite**: target the `js-*` class, never the styling class:

```js
$('.js-modify').on('click', () => { /* … */ });
```

## 10. Forgetting to scope per block

```js
// ❌ Global selectors — first match wins, others ignored
const $textarea = $('.js-textarea');
const $trigger = $('.js-trigger');

$trigger.on('click', () => $textarea.removeAttr('readonly'));
```

**Why it's bad**: if the block repeats, clicking *any* trigger unlocks the *first* textarea on the page. Subtle and infuriating to debug.

**Rewrite**: `.each()` + `find()`:

```js
$('.js-block').each(function () {
    const $block = $(this);
    const $trigger = $block.find('.js-trigger');
    const $textarea = $block.find('.js-textarea');

    $trigger.on('click', () => $textarea.removeAttr('readonly'));
});
```
