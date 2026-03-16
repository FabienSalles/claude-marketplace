# Routing Examples & Patterns

## Table of Contents
- [Nested Dynamic Routes](#nested-dynamic-routes)
- [Catch-All Routes](#catch-all-routes)
- [Pagination](#pagination)
- [API Routes](#api-routes)
- [URL Utilities](#url-utilities)
- [Redirects](#redirects)

## Nested Dynamic Routes

```astro
---
// src/pages/formations/[formation]/[day]/index.astro
import fs from 'node:fs';
import path from 'node:path';

export async function getStaticPaths() {
  const formationsDir = path.join(process.cwd(), 'src/content/formations');
  const paths = [];

  // Scan directory structure
  const formations = fs.readdirSync(formationsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  for (const formation of formations) {
    const daysDir = path.join(formationsDir, formation.name);
    const days = fs.readdirSync(daysDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'));

    for (const day of days) {
      paths.push({
        params: {
          formation: formation.name,
          day: day.name,
        },
        props: {
          formationPath: `${formation.name}/${day.name}`,
        },
      });
    }
  }

  return paths;
}

const { formation, day } = Astro.params;
const { formationPath } = Astro.props;
---
```

## Catch-All Routes

### Rest Parameters

```astro
---
// src/pages/[...slug].astro
// Matches: /a, /a/b, /a/b/c, etc.

export async function getStaticPaths() {
  return [
    { params: { slug: 'about' } },           // -> /about
    { params: { slug: 'blog/post-1' } },     // -> /blog/post-1
    { params: { slug: 'docs/api/intro' } },  // -> /docs/api/intro
    { params: { slug: undefined } },          // -> / (index)
  ];
}

const { slug } = Astro.params;
// slug is a string like "a/b/c" or undefined
const segments = slug?.split('/') ?? [];
---
```

### Priority Order

When routes conflict, Astro uses this priority:

1. Static routes (`/about.astro`)
2. Named parameters (`/blog/[slug].astro`)
3. Rest parameters (`/[...slug].astro`)

```
src/pages/
├── about.astro           -> /about (highest priority)
├── blog/
│   └── [slug].astro      -> /blog/* (medium priority)
└── [...slug].astro       -> /* (lowest priority)
```

## Pagination

### Built-in Pagination

```astro
---
// src/pages/blog/[page].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths({ paginate }) {
  const posts = await getCollection('blog');
  const sortedPosts = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return paginate(sortedPosts, { pageSize: 10 });
}

const { page } = Astro.props;
---

<ul>
  {page.data.map((post) => (
    <li><a href={`/blog/${post.slug}`}>{post.data.title}</a></li>
  ))}
</ul>

<nav>
  {page.url.prev && <a href={page.url.prev}>Previous</a>}
  <span>Page {page.currentPage} of {page.lastPage}</span>
  {page.url.next && <a href={page.url.next}>Next</a>}
</nav>
```

### Page Object Properties

```typescript
interface Page<T> {
  data: T[];              // Items for current page
  start: number;          // Index of first item
  end: number;            // Index of last item
  size: number;           // Items per page
  total: number;          // Total items
  currentPage: number;    // Current page number
  lastPage: number;       // Total pages
  url: {
    current: string;
    prev: string | undefined;
    next: string | undefined;
  };
}
```

## API Routes

### JSON Endpoint

```typescript
// src/pages/api/posts.json.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');

  return new Response(JSON.stringify(posts.map(p => ({
    slug: p.slug,
    title: p.data.title,
    date: p.data.pubDate,
  }))), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### RSS Feed

```typescript
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');

  return rss({
    title: 'My Blog',
    description: 'A blog about web development',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
    })),
  });
}
```

## URL Utilities

### Generate URLs

```typescript
// src/utils/url.ts
export function generateUrl(...segments: string[]): string {
  const path = segments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');

  return path.startsWith('/') ? path : `/${path}`;
}

// Usage
generateUrl('blog', post.slug);  // -> /blog/my-post
generateUrl('', 'about');        // -> /about
```

### Astro URL Object

```astro
---
const { pathname, search, hash } = Astro.url;
const isActive = (path: string) => pathname === path;
---

<a href="/about" class:list={[{ active: isActive('/about') }]}>About</a>
```

## Redirects

### Static Redirects

```astro
---
// src/pages/old-page.astro
return Astro.redirect('/new-page', 301);
---
```

### Redirect Map (astro.config)

```javascript
export default defineConfig({
  redirects: {
    '/old': '/new',
    '/blog/[...slug]': '/articles/[...slug]',
  },
});
```
