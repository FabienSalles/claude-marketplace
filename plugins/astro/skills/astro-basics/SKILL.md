---
name: astro-basics
description: This skill should be used when creating Astro components, layouts, pages, or working with Astro project structure. Provides core patterns for Astro 5.x development.
version: "1.0"
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
import { getCollection } from 'astro:content';

// 2. Props interface
interface Props {
  title: string;
  description?: string;
}

// 3. Data fetching (runs at build time)
const posts = await getCollection('blog');

// 4. Props destructuring
const { title, description = '' } = Astro.props;

// 5. Computed values
const sortedPosts = posts.sort((a, b) =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
---

<!-- 6. Template -->
<Layout title={title}>
  <h1>{title}</h1>
  <slot />
</Layout>

<!-- 7. Scoped styles (optional) -->
<style>
  h1 { color: var(--accent-color); }
</style>

<!-- 8. Client-side script (optional) -->
<script>
  console.log('Runs in browser');
</script>
```

## Layout Pattern

**BaseLayout.astro** - HTML skeleton with `<slot />`:

```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = '' } = Astro.props;
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  @import '@styles/global.scss';
</style>
```

## Props Patterns

### Required vs Optional

```astro
---
interface Props {
  title: string;           // Required
  description?: string;    // Optional
  tags?: string[];         // Optional array
}

const {
  title,
  description = 'Default description',
  tags = []
} = Astro.props;
---
```

### Class List

```astro
<div class:list={['base-class', { active: isActive, disabled: !enabled }]}>
  Content
</div>
```

## Slot Patterns

### Default Slot

```astro
<!-- Parent -->
<Card>
  <p>This goes into the default slot</p>
</Card>

<!-- Card.astro -->
<div class="card">
  <slot />
</div>
```

### Named Slots

```astro
<!-- Parent -->
<Card>
  <span slot="header">Title</span>
  <p>Body content</p>
  <span slot="footer">Footer</span>
</Card>

<!-- Card.astro -->
<div class="card">
  <header><slot name="header" /></header>
  <main><slot /></main>
  <footer><slot name="footer" /></footer>
</div>
```

## Style Scoping

### Scoped (default)

```astro
<style>
  /* Only applies to this component */
  h1 { color: blue; }
</style>
```

### Global

```astro
<style is:global>
  /* Applies globally */
  body { margin: 0; }
</style>
```

### External Import

```astro
<style is:global>
  @import '@styles/component.scss';
</style>
```

## Script Patterns

### Build-time Only (frontmatter)

```astro
---
// Runs only at build time
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
---
```

### Client-side Script

```astro
<script>
  // Runs in browser, bundled
  document.querySelector('button').addEventListener('click', () => {
    console.log('clicked');
  });
</script>
```

### Pass Data to Client

```astro
---
const config = { apiUrl: 'https://api.example.com' };
---

<script define:vars={{ config }}>
  console.log(config.apiUrl);
</script>
```

## Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@styles/*": ["src/styles/*"],
      "@lib/*": ["src/lib/*"]
    }
  }
}
```

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
