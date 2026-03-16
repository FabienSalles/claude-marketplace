# Astro Component Patterns

## Table of Contents
- [Layout Pattern](#layout-pattern)
- [Props Patterns](#props-patterns)
- [Slot Patterns](#slot-patterns)
- [Style Scoping](#style-scoping)
- [Script Patterns](#script-patterns)
- [Path Aliases](#path-aliases)

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

## Path Aliases

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
