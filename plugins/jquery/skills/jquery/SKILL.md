---
name: jquery
description: "ACTIVATE when writing or modifying jQuery code — any file using `$(...)`, `$el.find(...)`, `$(document).ready(...)`, or a new feature whose page interaction will be handled by jQuery. ACTIVATE for 'jQuery', 'jQuery module', 'js- selector', 'init function', 'event delegation', 'toggleClass', 'show hide pair', 'reset to original value'. Covers: one ES module per feature with exported init, `js-*` selector classes (never form IDs, never `data-*` for hooks), per-block scoping via `.each()` + `find()`, original state captured in closure (not lazily in DOM), symmetric `toggleClass` over swap helpers, jQuery state mutations (`.val()`, `.attr()`, `.removeAttr()`). DO NOT use for: vanilla JS without jQuery, React/Vue/Astro components, TypeScript-specific patterns, or build-tool / template-engine wiring (those belong with the backend framework's frontend skill)."
version: "1.0"
---

# jQuery Conventions

> Framework-agnostic. The companion concerns (where the JS file lives in the project tree, how it's bundled, how the template loads it) belong to the backend framework's frontend skill.

## Module Structure

One ES module per feature. Selector constants on top, exported `init<Feature>()`, side-effect binding at the bottom.

```js
import './my-feature.scss';

const BLOCK_SELECTOR = '.js-my-feature-block';
const TRIGGER_SELECTOR = '.js-my-feature-trigger';
const CONTENT_SELECTOR = '.js-my-feature-content';

export const initMyFeature = () => {
    $(BLOCK_SELECTOR).each(function () {
        const $block = $(this);
        const $trigger = $block.find(TRIGGER_SELECTOR);
        const $content = $block.find(CONTENT_SELECTOR);

        $trigger.on('click', () => $content.toggleClass('d-none'));
    });
};

$(document).ready(() => initMyFeature());
```

> For a full skeleton (multiple buttons, restore-original pattern, event delegation), see [references/module-template.md](references/module-template.md).

## Selectors — `js-*` only

Every JS hook is a CSS class prefixed `js-`. Renaming the hook is then one edit, and grepping `js-` finds every place JS touches the DOM.

| ✅ Use                     | ❌ Avoid                       | Why avoid                                                |
|---------------------------|-------------------------------|----------------------------------------------------------|
| `.js-edit-trigger`         | `#someform_field_id`           | Server-generated IDs change when the parent form changes |
| `.js-edit-trigger`         | `[data-action="edit"]`         | `data-*` is for state, not for hooking handlers          |
| `.js-edit-trigger`         | `.btn-primary`                 | Styling classes get refactored without warning           |
| `.js-edit-trigger`         | `.col-md-6:nth-child(2)`       | Structural selectors break on the smallest markup edit   |

`data-*` is fine for **state** (e.g. `data-original-value="..."`), never for **hooks**.

## Scoping — `.each()` + `find()`

When the same block repeats on a page, each block is its own state unit. Bind handlers inside `.each()` on a scoped wrapper. Don't bind global handlers and `closest()` your way back to the block.

```js
// ✅ Each block carries its own $textarea reference
$(BLOCK_SELECTOR).each(function () {
    const $block = $(this);
    const $trigger = $block.find(TRIGGER_SELECTOR);
    const $textarea = $block.find(TEXTAREA_SELECTOR);

    $trigger.on('click', () => $textarea.removeAttr('readonly'));
});
```

```js
// ❌ Global handler must navigate up at every click
$(document).on('click', TRIGGER_SELECTOR, function () {
    const $textarea = $(this).closest(BLOCK_SELECTOR).find(TEXTAREA_SELECTOR);
    $textarea.removeAttr('readonly');
});
```

Use event delegation (`$block.on('click', SELECTOR, …)`) **only** when the inner content is inserted dynamically (AJAX, collection types).

## Capture Original State in Closure

If the feature can restore a previous value (reset, cancel), capture it **once at init**, in the closure. Don't lazy-store it in a `data-*` the first time the user clicks.

```js
// ✅ Original lives in closure, captured at init
$(BLOCK_SELECTOR).each(function () {
    const $textarea = $(this).find(TEXTAREA_SELECTOR);
    const originalValue = $textarea.val();

    $resetButton.on('click', () => $textarea.val(originalValue));
});
```

```js
// ❌ Lazy storage in DOM — what if the user clicks Reset before Edit?
$editButton.on('click', () => {
    if ($textarea.data('original') === undefined) {
        $textarea.data('original', $textarea.val());
    }
});
```

The DOM holds the *current* state. Closures hold the *initial* state. Don't blur the two.

## Symmetric `toggleClass` over Swap Helpers

When two elements swap visibility, one `toggleClass` on the pair beats an `addClass`/`removeClass` helper that knows "which to show, which to hide".

```js
// ✅ Symmetric — the toggle is the truth
const $buttons = $block.find(`${EDIT_SELECTOR}, ${RESET_SELECTOR}`);

$block.on('click', EDIT_SELECTOR, () => {
    $textarea.removeAttr('readonly').trigger('focus');
    $buttons.toggleClass('d-none');
});

$block.on('click', RESET_SELECTOR, () => {
    $textarea.val(originalValue).attr('readonly', 'readonly');
    $buttons.toggleClass('d-none');
});
```

```js
// ❌ Helper that carries illusory logic
const swapButtons = ($shown, $hidden) => {
    $shown.addClass('d-none');
    $hidden.removeClass('d-none');
};
$editButton.on('click', () => swapButtons($editButton, $resetButton));
```

Both visibilities are mirror-images, so encoding "which to hide" is encoding the same fact twice.

## jQuery for DOM Mutations

Use jQuery for state mutations on jQuery wrappers (consistent API, chainable). Don't mix vanilla and jQuery on the same element.

| State                  | jQuery                                            |
|------------------------|---------------------------------------------------|
| Set value              | `$textarea.val(value)`                            |
| Clear value            | `$textarea.val('')`                               |
| Make read-only         | `$textarea.attr('readonly', 'readonly')`          |
| Make editable          | `$textarea.removeAttr('readonly')`                |
| Toggle visibility      | `$el.toggleClass('d-none')`                       |
| Toggle a state class   | `$el.toggleClass('is-active')`                    |
| Focus                  | `$el.trigger('focus')` (preferred over `.focus()`)|

Chain when it reads naturally: `$textarea.val(originalValue).attr('readonly', 'readonly')`.

> For mistakes that look reasonable but break in production (vanilla `document.querySelectorAll` mixed with jQuery, hardcoded form IDs, FormType-injected classes used as JS hooks, polluting `data-*`), see [references/anti-patterns.md](references/anti-patterns.md).

## Quick Reference

| Situation                                | Approach                                                   |
|------------------------------------------|------------------------------------------------------------|
| New feature                              | One ES module, exports `init<Feature>()`                   |
| Hook a DOM element from JS               | `js-*` class — never ID, never `data-*`, never styling     |
| Block repeats on the page                | Scope inside `.each()` + `find()`                          |
| Inner content mutates (AJAX, collection) | Event delegation: `$block.on('click', SELECTOR, …)`        |
| Need to restore initial value            | Capture in closure at init, not lazily in `data-*`         |
| Two elements swap visibility             | `$pair.toggleClass('d-none')` in both handlers             |
| Make textarea editable                   | `$el.removeAttr('readonly').trigger('focus')`              |
| Make textarea read-only                  | `$el.attr('readonly', 'readonly')`                         |
| Full module skeleton                     | See [references/module-template.md](references/module-template.md) |
| Common mistakes and rewrites             | See [references/anti-patterns.md](references/anti-patterns.md)     |
