---
name: astro-content-collections
description: "ACTIVATE when working with Astro content collections, markdown/MDX files, YAML frontmatter, Zod schemas for content, or content-driven pages. ACTIVATE for 'getCollection', 'getEntry', 'defineCollection', 'content collection', 'config.ts'. Covers: collection schema definition with Zod, querying/filtering collections, dynamic routes with getStaticPaths, YAML meta files, MDX with components, collection references. DO NOT use for: routing logic (see astro-routing), general Astro components (see astro-basics)."
version: "1.1"
---

# Astro Content Collections

Patterns for managing structured content in Astro projects.

## Collection Structure

```
src/content/
├── config.ts           # Schema definitions (optional but recommended)
├── blog/               # Collection: blog posts
│   └── my-post.md
├── projects/           # Collection: project showcases
│   └── project-1.md
└── formations/         # Collection: training content
    └── ddd/
        └── jour-1/
            └── _meta.yaml
```

## Querying Collections

```astro
---
import { getCollection, getEntry } from 'astro:content';

// Get all, filter drafts in production
const posts = await getCollection('blog', ({ data }) => {
  return import.meta.env.PROD ? !data.draft : true;
});

// Sort by date
const sortedPosts = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);

// Get single entry
const post = await getEntry('blog', 'my-post');
---
```

> **When defining collection schemas with Zod** (blog, projects, data-only collections), read `references/collection-patterns.md` for complete schema examples with typed frontmatter.

> **When creating dynamic routes or category pages from collections**, read `references/collection-patterns.md` for getStaticPaths patterns and category filtering.

> **When using MDX with components, YAML meta files, or collection references**, read `references/collection-patterns.md` for advanced content patterns.

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
