---
name: astro-tailwind
description: "ACTIVATE when styling Astro components with Tailwind CSS, configuring tailwind.config, or implementing responsive layouts. ACTIVATE for 'Tailwind', 'utility classes', '@tailwindcss/typography', 'prose', 'dark mode'. Covers: project-specific Tailwind config (colors, fonts), common UI patterns (cards, nav, forms, grids, buttons), typography plugin for markdown content, responsive patterns, dark mode, CSS variables with Tailwind. DO NOT use for: general CSS questions, Astro scoped styles without Tailwind."
version: "1.1"
---

# Astro + Tailwind CSS

Patterns for utility-first CSS in Astro projects.

## Setup

```bash
npx astro add tailwind
```

### Config

**tailwind.config.mjs**:
```javascript
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#FFD700',
        secondary: '#FFC000',
        dark: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
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
