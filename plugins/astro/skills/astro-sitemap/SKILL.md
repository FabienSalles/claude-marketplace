---
name: astro-sitemap
description: "ACTIVATE when configuring XML sitemaps, robots.txt, or page indexing in Astro. ACTIVATE for 'sitemap', 'robots.txt', '@astrojs/sitemap', 'sitemap filter'. Covers: @astrojs/sitemap setup, page filtering, custom priority/changefreq via serialize, multi-language sitemap with hreflang, robots.txt generation, dynamic content priority. DO NOT use for: SEO meta tags (see astro-seo), general routing."
version: "1.1"
---

# Astro Sitemap

Patterns for automatic XML sitemap generation in Astro.

## Setup

```bash
npx astro add sitemap
```

```javascript
// astro.config.mjs
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

> **When using serialize to transform entries, implementing multi-language sitemaps, or dynamic content priority**, read `references/sitemap-configuration-examples.md` for complete configuration patterns.

> **When creating robots.txt** (basic or with disallow rules), read `references/sitemap-configuration-examples.md` for API route implementations.

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
