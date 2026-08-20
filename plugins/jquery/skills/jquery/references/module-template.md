# Module Template

Full skeleton for a jQuery feature module covering: scoped state per block, restore-original pattern, symmetric `toggleClass`, event delegation when needed.

## Feature: Editable Block with Reset

A block displays content in a read-only textarea. Clicking **Edit** unlocks the textarea and swaps the button to **Reset**. Clicking **Reset** restores the original value, re-locks the textarea, and swaps the button back to **Edit**.

```js
import './editable-block.scss';

const BLOCK_SELECTOR = '.js-editable-block';
const TEXTAREA_SELECTOR = '.js-editable-block-textarea';
const EDIT_BUTTON_SELECTOR = '.js-editable-block-edit';
const RESET_BUTTON_SELECTOR = '.js-editable-block-reset';
const HIDDEN_CLASS = 'd-none';

export const initEditableBlock = () => {
    $(BLOCK_SELECTOR).each(function () {
        const $block = $(this);
        const $textarea = $block.find(TEXTAREA_SELECTOR);
        const $editButton = $block.find(EDIT_BUTTON_SELECTOR);
        const $resetButton = $block.find(RESET_BUTTON_SELECTOR);
        const $buttons = $editButton.add($resetButton);
        const originalValue = $textarea.val();

        $editButton.on('click', () => {
            $textarea.removeAttr('readonly').trigger('focus');
            $buttons.toggleClass(HIDDEN_CLASS);
        });

        $resetButton.on('click', () => {
            $textarea.val(originalValue).attr('readonly', 'readonly');
            $buttons.toggleClass(HIDDEN_CLASS);
        });
    });
};

$(document).ready(() => initEditableBlock());
```

### Anatomy

| Region                                      | Role                                                                          |
|---------------------------------------------|-------------------------------------------------------------------------------|
| `import './*.scss'`                          | Bundle feature CSS with feature JS                                            |
| Selector constants                           | One per `js-*` class — single source of truth for hooks                       |
| `export const init<Feature> = () => {...}`   | Side-effect-free entry point, callable by re-init after AJAX                  |
| `$(BLOCK_SELECTOR).each(function () {...})` | Scope per block — each block gets its own `$textarea`, `$buttons`, `original` |
| `const originalValue = $textarea.val();`     | Captured in closure at init time, not lazily in `data-*`                      |
| `$buttons = $block.find('A, B')`             | The two buttons treated as a single set for `toggleClass`                     |
| `$editButton.on('click', …)`                 | Direct binding — the buttons are static, delegation is only for dynamic content |
| `$(document).ready(() => init...())`         | Single side-effect line at the bottom; testable logic stays in the export     |

### Matching HTML

```html
<div class="js-editable-block">
    <header>
        <span>Block title</span>
        <button type="button" class="js-editable-block-edit">Edit</button>
        <button type="button" class="js-editable-block-reset d-none">Reset</button>
    </header>
    <textarea class="js-editable-block-textarea" readonly>Original content here</textarea>
</div>
```

The HTML carries:
- The `js-*` hooks (only purpose: JS targeting)
- The initial `readonly` attribute
- The initial `d-none` on the Reset button (one button visible at a time)
- The initial textarea content (the "original")

### Matching SCSS

```scss
/* editable-block.scss */
.js-editable-block textarea[readonly] {
    background-color: #fff;
}
```

Same `js-` class used as JS hook. Splitting into a separate styling class for a single rule is over-engineering. CSS selector specificity `(0, 2, 1)` beats Bootstrap's `.form-control[readonly]` `(0, 2, 0)` — no `!important` needed.

## Variants

### Multiple sibling blocks

The `.each()` scoping makes this free. Each block on the page keeps its own `originalValue` and its own `$buttons` set. No shared state.

### Re-init after AJAX

Export `init<Feature>()` so a caller can re-bind after content is replaced. Avoid double-binding by namespacing events:

```js
$trigger.off('click.editableBlock').on('click.editableBlock', () => { /* … */ });
```

### Programmatic reset

Expose a small API by attaching to `$block.data()`:

```js
$block.data('reset', () => {
    $textarea.val(originalValue).attr('readonly', 'readonly');
    $buttons.toggleClass(HIDDEN_CLASS);
});

// Caller:
$('.js-editable-block').data('reset')();
```

Use sparingly. Most cases don't need a programmatic API.
