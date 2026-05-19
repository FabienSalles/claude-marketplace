---
name: frontend-best-practices
description: "ACTIVATE when modifying existing frontend components/styles (CSS/SCSS, Twig, HTML, React, Vue), when encountering visual bugs, or when the user describes multiple constraints that may conflict. ACTIVATE for 'modify existing', 'side effect', 'régression', 'existing component', 'composant existant', 'bug visuel', 'visual bug', 'devtools', 'inspection', 'contraintes Figma', 'too small', 'misaligned', 'pixel-perfect'. Covers: avoiding side effects on existing functional UI by adding-not-modifying, lifting incompatible constraints to the user BEFORE coding, autonomous visual debugging via Chrome DevTools MCP (never ask the user for sizes/colors/positions that can be inspected). DO NOT use for: clean-architecture decisions (see frontend-clean-architecture), Container/Presentation split (see frontend-component-patterns), Twig component creation rules (see php-twig-conventions)."
version: "1.0.0"
---

# Frontend Best Practices

Methodology for modifying existing frontend code without regressions, surfacing constraint conflicts upfront, and debugging visual issues autonomously.

These are the three habits that turn long, iterative frontend sessions into focused 3-step exchanges.

## 1. No side effects on existing UI

Components already deployed in production are **functional and validated**. Before modifying any existing CSS selector, padding, color, or rule that is already applied somewhere:

- Ask: can I **add** a new class / variant / scoped selector instead of **modifying** the existing rule?
- If modification is truly unavoidable, `grep` all upstream usages and quantify the impact (how many templates, which projects, who maintains them)

### Pattern: extend, don't modify

```scss
// ❌ Modifies the existing rule used by every Badge in production
.badge {
    padding: 4px 12px;          // was: 6px 12px → may break alignment elsewhere
    background-color: $primary; // was: $default-200 → changes every existing badge
}
```

```scss
// ✅ Adds a new variant, existing badges unchanged
.badge {
    /* ... existing rules untouched ... */
}

&[class*="badge-outline"] {
    background-color: $default-100;
    border: 1px solid $default-300;
}

&.badge-outline-primary { color: $primary; }
```

### When in doubt: scoped wrapper

If you need a deviation in just one place (a design system demo, a one-off layout), use a scoped wrapper class rather than altering a shared component:

```html
<div class="my-feature-area">
    <SharedComponent />
</div>
```

```scss
.my-feature-area .shared-component-internal { /* scoped override */ }
```

The shared component stays untouched. The override is contained.

## 2. Lift constraint conflicts BEFORE coding

When the user states multiple constraints, verify their **physical compatibility** first. A common failure mode is to start coding the first interpretation and iterate when the others break — this can burn 4-6 round-trips on the same property.

### Typical example

The user says:
- "Preserve the existing 10px header/body alignment"
- "Align the indicator stripe with the header text (x = 10px)"
- "Respect the 8px Figma gap between stripe and body text"

These are **physically incompatible**: if the stripe is at x = 10 and the body text is also at x = 10 (preserved alignment), there cannot be an 8px gap between them.

### What to do BEFORE writing code

Write back to the user explicitly:

> Your 3 constraints conflict:
> - (1) implies body text at x = 10
> - (2) implies stripe at x = 10
> - (1) + (2) means stripe and text overlap → (3) cannot be satisfied
>
> Which takes priority? Or do you accept shifting body text to x = 20 (breaks 1) to satisfy 2 + 3?

This single message saves typically 4-5 iterations. The user picks the priority and you implement once.

### Heuristic for spotting conflicts

Whenever a request includes:
- Two or more positional/size constraints on the same axis
- A "preserve existing X" alongside a "match design Y" with non-trivial deltas
- Multiple visual references (Figma + screenshot + existing component)

→ Pause, write the constraint matrix, and ask which wins.

## 3. Chrome DevTools as first reflex for visual debugging

If the user reports a visual issue ("the marker is too small", "the text is misaligned", "the color is off"):

1. **Don't ask** for values (size, color, position, computed style) — inspect directly
2. Use the `chrome-devtools` MCP (`mcp__chrome-devtools__evaluate_script`) to retrieve `getBoundingClientRect()`, `getComputedStyle()`, and DOM structure of the element AND its siblings/parent
3. Identify the root cause (`display: flex` on a `td` breaks row height inheritance, an inherited `font-size` overrides yours, a `:has()` selector cascades wider than expected, etc.) BEFORE proposing a fix

### Example inspection script

```js
() => {
  const el = document.querySelector('.marker');
  const parent = el.closest('td');
  const sibling = parent?.nextElementSibling;
  return {
    el: {
      height: el.getBoundingClientRect().height,
      display: getComputedStyle(el).display,
      alignSelf: getComputedStyle(el).alignSelf,
    },
    parent: {
      height: parent.getBoundingClientRect().height,
      display: getComputedStyle(parent).display,
      verticalAlign: getComputedStyle(parent).verticalAlign,
    },
    sibling: sibling ? {
      height: sibling.getBoundingClientRect().height,
      display: getComputedStyle(sibling).display,
    } : null,
  };
}
```

The output tells you exactly what's happening — no guessing, no asking. You become **autonomous**: measure, diagnose, propose.

### What to inspect first

For any visual bug, default to inspecting:
- **Sizes** : width, height, padding, margin (and how they compare to siblings)
- **Display** : block / inline / flex / grid / table-cell (changes inheritance dramatically)
- **Alignment** : vertical-align, align-items, align-self, text-align
- **Cascade** : computed font, color, line-height (often inherited from parent)

### When to ask the user

Only ask when:
- You can't access the rendered DOM (no MCP, restricted env, auth wall blocking inspection)
- The visual issue depends on user input you don't have (form state, hover, focus, viewport size)

In every other case, inspect first.

## Quick decision flow

```
Frontend modification incoming
        │
        ├─→ Existing component? ── Yes ──→ Can I ADD instead of MODIFY?
        │                                       │
        │                                       └─→ No → grep usages, quantify impact
        │
        ├─→ Multiple constraints? ── Yes ──→ Compatible? → No → lift to user
        │
        └─→ Visual bug? ── Yes ──→ Inspect via DevTools MCP first → diagnose → propose
```
