---
name: astro-basics
description: "ACTIVATE when creating Astro components, layouts, pages, or setting up Astro project structure. ACTIVATE for 'Astro component', 'slot', 'layout', 'Astro.props', 'class:list'. Covers: component anatomy (frontmatter/template/style/script), layout pattern with slot, props patterns, scoped vs global styles, script patterns (build-time vs client-side), path aliases. DO NOT use for: content collections (see astro-content-collections), routing (see astro-routing), React islands (see astro-react)."
version: "1.1"
---

# Astro Basics

Core patterns for Astro 5.x development based on project conventions.

## Project Structure

```
src/
├── components/     # Reusable .astro components
├── content/        # Content collections (markdown, yaml)
│   └── config.ts   # Collection schemas (Zod)
├── layouts/        # Page layouts (BaseLayout, etc.)
├── pages/          # File-based routing
│   ├── index.astro
│   └── [...slug].astro  # Dynamic routes
├── styles/         # Global styles (SCSS or Tailwind)
└── utils/          # Helper functions
public/             # Static assets (copied to dist/)
```

## Component Anatomy

```astro
---
// 1. Imports
import Layout from '@layouts/Layout.astro';

// 2. Props interface
interface Props {
  title: string;
  description?: string;
}

// 3. Data fetching (runs at build time)
const posts = await getCollection('blog');

// 4. Props destructuring
const { title, description = '' } = Astro.props;
---

<!-- 5. Template -->
<Layout title={title}>
  <h1>{title}</h1>
  <slot />
</Layout>

<!-- 6. Scoped styles (optional) -->
<style>
  h1 { color: var(--accent-color); }
</style>

<!-- 7. Client-side script (optional) -->
<script>
  console.log('Runs in browser');
</script>
```

> **When implementing layouts, props patterns, named slots, style scoping, or script patterns**, read `references/component-patterns.md` for complete BaseLayout, slot, style, and script examples.

> **When setting up path aliases** (tsconfig.json), read `references/component-patterns.md` for the standard alias configuration.

## Quick Reference

| Pattern | Usage |
|---------|-------|
| `Astro.props` | Access component props |
| `Astro.url` | Current URL object |
| `Astro.params` | Route parameters |
| `Astro.slots.has('name')` | Check if slot provided |
| `<slot />` | Render children |
| `class:list={[]}` | Conditional classes |
| `set:html={html}` | Render raw HTML |
| `define:vars={{}}` | Pass vars to script |
| `is:global` | Global styles |
