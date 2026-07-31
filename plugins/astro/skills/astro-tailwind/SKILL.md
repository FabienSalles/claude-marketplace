---
name: astro-tailwind
description: "ACTIVATE when styling Astro components with Tailwind CSS, configuring the `@theme` block, or implementing responsive layouts. ACTIVATE for 'Tailwind', 'utility classes', '@tailwindcss/typography', 'prose', 'dark mode'. Covers: Tailwind 4 CSS-first config (colors, fonts via `@theme`), common UI patterns (cards, nav, forms, grids, buttons), typography plugin for markdown content, responsive patterns, dark mode, CSS variables with Tailwind. DO NOT use for: general CSS questions, Astro scoped styles without Tailwind."
version: "1.1"
---

# Astro + Tailwind CSS

Patterns for utility-first CSS in Astro projects.

## Setup

```bash
npm install tailwindcss @tailwindcss/vite
```

**astro.config.mjs**:
```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

### Config

Tailwind 4 is CSS-first: tokens are declared in the stylesheet with `@theme`, there is no separate JavaScript config file.

**src/styles/global.css**:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-primary: #FFD700;
  --color-secondary: #FFC000;
  --color-dark: #1A1A1A;
  --font-sans: 'Inter Variable', system-ui, sans-serif;
}
```

Import that stylesheet once, from a layout:

```astro
---
import '../styles/global.css';
---
```

## Common Patterns

### Layout Container

```astro
<main class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <slot />
  </div>
</main>
```

### Prose for Markdown

```astro
<article class="prose prose-lg prose-gray max-w-none">
  <Content />
</article>
```

> **When building navigation headers, cards, buttons, forms, or grid layouts**, read `references/ui-patterns.md` for complete Tailwind component patterns.

> **When configuring the typography plugin or dark mode**, read `references/ui-patterns.md` for prose customization and dark mode setup.

## Responsive Breakpoints

| Prefix | Min Width |
|--------|-----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

## Quick Reference

| Pattern | Classes |
|---------|---------|
| Center content | `mx-auto max-w-7xl` |
| Flex center | `flex items-center justify-center` |
| Sticky header | `sticky top-0 z-50` |
| Card shadow | `shadow-lg hover:shadow-xl transition-shadow` |
| Truncate text | `truncate` or `line-clamp-2` |
| Glass effect | `bg-white/80 backdrop-blur-sm` |
| Focus ring | `focus:ring-2 focus:ring-primary focus:outline-none` |
| Gradient text | `bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent` |
