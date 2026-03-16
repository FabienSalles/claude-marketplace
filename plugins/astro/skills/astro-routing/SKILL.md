---
name: astro-routing
description: "ACTIVATE when creating dynamic routes, catch-all routes, pagination, API endpoints, or static path generation in Astro. ACTIVATE for 'getStaticPaths', '[slug]', '[...slug]', 'paginate', 'API route', 'redirect'. Covers: file-based routing, single/multiple/nested dynamic parameters, catch-all routes with priority, built-in pagination, API routes (JSON/RSS), URL utilities, redirects. DO NOT use for: content collection queries (see astro-content-collections), i18n routes (see astro-i18n)."
version: "1.1"
---

# Astro Routing

Patterns for file-based and dynamic routing in Astro.

## File-Based Routes

```
src/pages/
├── index.astro           -> /
├── about.astro           -> /about
├── blog/
│   ├── index.astro       -> /blog
│   └── [slug].astro      -> /blog/:slug
├── [...slug].astro       -> /* (catch-all)
└── api/
    └── data.json.ts      -> /api/data.json
```

## Dynamic Routes

### Single Parameter

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
---
<h1>{post.data.title}</h1>
```

### Multiple Parameters

```astro
---
// src/pages/[lang]/blog/[slug].astro
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  const languages = ['en', 'fr'];

  return languages.flatMap((lang) =>
    posts.map((post) => ({
      params: { lang, slug: post.slug },
      props: { post, lang },
    }))
  );
}
---
```

### Route Priority

1. Static routes (`/about.astro`) -- highest
2. Named parameters (`/blog/[slug].astro`) -- medium
3. Rest parameters (`/[...slug].astro`) -- lowest

> **When implementing nested dynamic routes, catch-all routes, pagination, or API endpoints**, read `references/routing-examples.md` for complete implementations with getStaticPaths, paginate, JSON/RSS endpoints, and redirect patterns.

## Quick Reference

| Pattern | Route | Example URL |
|---------|-------|-------------|
| `index.astro` | Root | `/` |
| `about.astro` | Static | `/about` |
| `[slug].astro` | Dynamic | `/post-1`, `/post-2` |
| `[...slug].astro` | Catch-all | `/a/b/c` |
| `[lang]/[slug].astro` | Multi-param | `/en/about` |
| `[page].astro` + paginate | Pagination | `/1`, `/2` |
| `file.json.ts` | API | `/file.json` |
