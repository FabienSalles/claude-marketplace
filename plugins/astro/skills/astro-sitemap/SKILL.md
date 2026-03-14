---
name: astro-sitemap
description: This skill should be used when configuring XML sitemaps in Astro, filtering pages, or setting up sitemap generation. Covers @astrojs/sitemap integration.
version: "1.0"
---

# Astro Sitemap

Patterns for automatic XML sitemap generation in Astro.

## Setup

```bash
npx astro add sitemap
```

**astro.config.mjs**:
```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com', // Required!
  integrations: [sitemap()],
});
```

## Configuration Options

### Basic Configuration

```javascript
sitemap({
  changefreq: 'weekly',
  priority: 0.7,
  lastmod: new Date(),
})
```

### Filter Pages

```javascript
sitemap({
  filter: (page) =>
    !page.includes('/admin/') &&
    !page.includes('/draft/') &&
    !page.includes('/private/'),
})
```

### Custom Entries

```javascript
sitemap({
  customPages: [
    'https://example.com/external-page',
    'https://example.com/dynamic-route',
  ],
})
```

### Serialize (Transform Entries)

```javascript
sitemap({
  serialize: (item) => {
    // Set priority based on path depth
    const depth = item.url.split('/').filter(Boolean).length;
    item.priority = Math.max(0.1, 1 - depth * 0.2);

    // Higher priority for blog index
    if (item.url.includes('/blog/')) {
      item.changefreq = 'daily';
      item.priority = 0.9;
    }

    return item;
  },
})
```

## Multi-Language Sitemap

### With i18n Configured

```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://example.com',
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'fr',
        locales: {
          fr: 'fr-FR',
          en: 'en-US',
        },
      },
    }),
  ],
});
```

### Manual Language Alternates

```javascript
sitemap({
  serialize: (item) => {
    // Add hreflang alternates
    if (!item.url.includes('/en/')) {
      item.links = [
        { lang: 'fr', url: item.url },
        { lang: 'en', url: item.url.replace('example.com/', 'example.com/en/') },
      ];
    }
    return item;
  },
})
```

## Dynamic Content Priority

```javascript
import { getCollection } from 'astro:content';

sitemap({
  serialize: async (item) => {
    // Fresh blog posts get higher priority
    if (item.url.includes('/blog/')) {
      const posts = await getCollection('blog');
      const post = posts.find(p => item.url.includes(p.slug));

      if (post) {
        const daysSincePublished = Math.floor(
          (Date.now() - post.data.pubDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Recent posts get higher priority
        item.priority = daysSincePublished < 30 ? 0.9 : 0.7;
        item.lastmod = post.data.pubDate;
      }
    }

    return item;
  },
})
```

## robots.txt Integration

### Basic robots.txt

```typescript
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site);

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${sitemapUrl.href}
`,
    {
      headers: { 'Content-Type': 'text/plain' },
    }
  );
};
```

### With Disallow Rules

```typescript
// src/pages/robots.txt.ts
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site);

  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /draft/
Disallow: /*.json$

User-agent: GPTBot
Disallow: /

Sitemap: ${sitemapUrl.href}
`,
    {
      headers: { 'Content-Type': 'text/plain' },
    }
  );
};
```

## Multiple Sitemaps

For large sites, split sitemaps by section:

```javascript
sitemap({
  entryLimit: 10000, // Default, entries per sitemap file
})
```

Output structure:
```
dist/
├── sitemap-index.xml    # Index pointing to child sitemaps
├── sitemap-0.xml        # First 10000 entries
└── sitemap-1.xml        # Next entries (if needed)
```

## Complete Example

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fabiensalles.com',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),

      filter: (page) =>
        !page.includes('/draft/') &&
        !page.includes('/admin/'),

      serialize: (item) => {
        // Home page
        if (item.url === 'https://fabiensalles.com/') {
          item.changefreq = 'daily';
          item.priority = 1.0;
        }

        // Blog posts
        if (item.url.includes('/blog/')) {
          item.changefreq = 'monthly';
          item.priority = 0.8;
        }

        // Static pages
        if (['/about/', '/contact/', '/cv/'].some(p => item.url.includes(p))) {
          item.changefreq = 'monthly';
          item.priority = 0.6;
        }

        return item;
      },
    }),
  ],
});
```

## Quick Reference

### Sitemap Entry Properties

| Property | Values | Description |
|----------|--------|-------------|
| `url` | string | Page URL (auto-generated) |
| `lastmod` | Date | Last modification date |
| `changefreq` | `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never` | Update frequency hint |
| `priority` | 0.0 - 1.0 | Relative importance |
| `links` | array | Language alternates |

### Output Files

| File | Description |
|------|-------------|
| `sitemap-index.xml` | Index of all sitemap files |
| `sitemap-0.xml` | First sitemap (up to 10000 entries) |
| `sitemap-N.xml` | Additional sitemaps if needed |
