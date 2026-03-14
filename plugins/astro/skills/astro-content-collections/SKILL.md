---
name: astro-content-collections
description: This skill should be used when working with Astro content collections, markdown files, YAML frontmatter, Zod schemas, or content-driven pages. Provides patterns for content management in Astro.
version: "1.0"
---

# Astro Content Collections

Patterns for managing structured content in Astro projects.

## Collection Structure

```
src/content/
├── config.ts           # Schema definitions (optional but recommended)
├── blog/               # Collection: blog posts
│   ├── 2024/
│   │   └── my-post.md
│   └── draft.md
├── projects/           # Collection: project showcases
│   └── project-1.md
└── formations/         # Collection: training content
    └── ddd/
        └── jour-1/
            ├── _meta.yaml
            └── slides/
```

## Schema Definition (config.ts)

```typescript
import { defineCollection, z } from 'astro:content';

// Blog posts collection
const blog = defineCollection({
  type: 'content',  // Markdown/MDX
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Anonymous'),
  }),
});

// Projects collection
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    date: z.string(),
    gallery: z.array(z.object({
      url: z.string(),
      alt: z.string(),
    })).optional(),
    price: z.number().optional(),
  }),
});

// Data-only collection (YAML/JSON)
const authors = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().url(),
  }),
});

export const collections = { blog, projects, authors };
```

## Querying Collections

### Get All Entries

```astro
---
import { getCollection } from 'astro:content';

// Get all blog posts
const allPosts = await getCollection('blog');

// Filter drafts in production
const posts = await getCollection('blog', ({ data }) => {
  return import.meta.env.PROD ? !data.draft : true;
});

// Sort by date
const sortedPosts = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
---
```

### Get Single Entry

```astro
---
import { getEntry } from 'astro:content';

// By slug
const post = await getEntry('blog', 'my-post');

// By reference (from another collection)
const author = await getEntry(post.data.author);
---
```

## Dynamic Routes with Collections

### Single Dynamic Route

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<article>
  <h1>{post.data.title}</h1>
  <time>{post.data.pubDate.toLocaleDateString()}</time>
  <Content />
</article>
```

### Category Pages

```astro
---
// src/pages/blog/categories/[category].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  const categories = [...new Set(posts.flatMap(p => p.data.tags))];

  return categories.map((category) => ({
    params: { category },
    props: {
      posts: posts.filter(p => p.data.tags.includes(category)),
    },
  }));
}

const { category } = Astro.params;
const { posts } = Astro.props;
---
```

## Frontmatter Patterns

### Markdown with YAML

```markdown
---
title: "My Blog Post"
description: "A great article about Astro"
version: "1.0"
pubDate: 2024-01-15
tags:
  - astro
  - web
draft: false
---

# Content starts here

Regular markdown content...
```

### MDX with Components

```mdx
---
title: "Interactive Post"
pubDate: 2024-01-15
---

import Chart from '../../components/Chart.astro';

# My Post

<Chart data={[1, 2, 3]} />

Regular content continues...
```

## YAML Meta Files Pattern

For complex content structures (like formations):

```yaml
# _meta.yaml
id: ddd-jour-1
title: "Domain Driven Design - Jour 1"
tags:
  - DDD
  - Architecture
author: "Fabien Salles"
```

```astro
---
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const metaPath = path.join(process.cwd(), 'src/content/formations/ddd/jour-1/_meta.yaml');
const meta = yaml.load(fs.readFileSync(metaPath, 'utf-8'));
---

<h1>{meta.title}</h1>
```

## Rendering Content

### Basic Render

```astro
---
const { Content } = await post.render();
---

<article class="prose">
  <Content />
</article>
```

### With Components

```astro
---
const { Content, headings, remarkPluginFrontmatter } = await post.render();
---

<!-- Table of contents from headings -->
<nav>
  {headings.map(h => (
    <a href={`#${h.slug}`}>{h.text}</a>
  ))}
</nav>

<Content components={{ img: CustomImage }} />
```

## Collection References

Link between collections:

```typescript
// config.ts
const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    author: reference('authors'),  // Reference to authors collection
    relatedPosts: z.array(reference('blog')).optional(),
  }),
});
```

```astro
---
import { getEntry } from 'astro:content';

const post = await getEntry('blog', 'my-post');
const author = await getEntry(post.data.author);
---

<p>Written by {author.data.name}</p>
```

## Quick Reference

| Function | Usage |
|----------|-------|
| `getCollection('name')` | Get all entries |
| `getCollection('name', filter)` | Get filtered entries |
| `getEntry('name', 'slug')` | Get single entry |
| `post.render()` | Get Content component |
| `post.slug` | URL-safe identifier |
| `post.id` | File path relative to collection |
| `post.data` | Typed frontmatter data |
| `post.body` | Raw markdown content |
| `reference('collection')` | Cross-collection reference |
