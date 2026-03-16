---
name: astro-seo
description: "ACTIVATE when implementing SEO meta tags, Open Graph, Twitter cards, JSON-LD structured data, or canonical URLs in Astro. ACTIVATE for 'SEO', 'meta tags', 'og:image', 'structured data', 'JSON-LD', 'canonical'. Covers: reusable SEO component, Open Graph/Twitter card meta, JSON-LD structured data (Organization, Person, BlogPosting, Breadcrumbs), multilingual SEO with hreflang, blog post SEO. DO NOT use for: sitemap configuration (see astro-sitemap), general HTML head management."
version: "1.1"
---

# Astro SEO Patterns

Patterns for search engine optimization and social sharing in Astro.

## Basic Head Structure

```astro
---
const {
  title,
  description = "Default site description",
  image = "/og-default.png",
  canonicalUrl,
  noindex = false,
} = Astro.props;

const siteUrl = Astro.site?.toString() || 'https://example.com';
const currentUrl = canonicalUrl || Astro.url.href;
const ogImage = new URL(image, siteUrl).toString();
---

<head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {noindex && <meta name="robots" content="noindex, nofollow" />}
  <link rel="canonical" href={currentUrl} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={currentUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:image" content={ogImage} />
</head>
```

> **When creating a reusable SEO component or blog post SEO page**, read `references/seo-components-and-structured-data.md` for the complete SEO.astro component with article support.

> **When adding JSON-LD structured data** (Organization, Person, BlogPosting, Breadcrumbs), read `references/seo-components-and-structured-data.md` for all schema.org patterns.

> **When implementing multilingual SEO with hreflang**, read `references/seo-components-and-structured-data.md` for hreflang and og:locale patterns.

## Quick Reference

### Essential Meta Tags

| Tag | Purpose |
|-----|---------|
| `<title>` | Page title (50-60 chars) |
| `meta[description]` | Page description (150-160 chars) |
| `link[canonical]` | Preferred URL |
| `meta[robots]` | Indexing instructions |

### Open Graph (Facebook/LinkedIn)

| Property | Required |
|----------|----------|
| `og:title` | Yes |
| `og:type` | Yes (`website`, `article`) |
| `og:image` | Yes (1200x630px) |
| `og:url` | Yes |
| `og:description` | Recommended |

### Twitter Cards

| Property | Value |
|----------|-------|
| `twitter:card` | `summary` or `summary_large_image` |
| `twitter:title` | Same as og:title |
| `twitter:description` | Same as og:description |
| `twitter:image` | Same as og:image |
