---
name: astro-seo
description: This skill should be used when implementing SEO meta tags, Open Graph, Twitter cards, structured data, or canonical URLs in Astro. Covers head management patterns.
version: "1.0"
---

# Astro SEO Patterns

Patterns for search engine optimization and social sharing in Astro.

## Basic Head Structure

```astro
---
// src/layouts/Layout.astro
interface Props {
  title: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}

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
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary Meta -->
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="author" content="Author Name" />

  <!-- Robots -->
  {noindex && <meta name="robots" content="noindex, nofollow" />}

  <!-- Canonical -->
  <link rel="canonical" href={currentUrl} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={currentUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:site_name" content="Site Name" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={currentUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

  <!-- RSS -->
  <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/rss.xml" />
</head>
```

## SEO Component

```astro
---
// src/components/SEO.astro
interface Props {
  title: string;
  description: string;
  image?: string;
  article?: {
    publishedTime: Date;
    modifiedTime?: Date;
    authors?: string[];
    tags?: string[];
  };
  noindex?: boolean;
}

const {
  title,
  description,
  image = '/og-default.png',
  article,
  noindex = false,
} = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, '') || '';
const canonicalUrl = `${siteUrl}${Astro.url.pathname}`;
const ogImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
---

<!-- Primary -->
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalUrl} />
{noindex && <meta name="robots" content="noindex, nofollow" />}

<!-- Open Graph -->
<meta property="og:url" content={canonicalUrl} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={ogImage} />
<meta property="og:type" content={article ? 'article' : 'website'} />

{article && (
  <>
    <meta property="article:published_time" content={article.publishedTime.toISOString()} />
    {article.modifiedTime && (
      <meta property="article:modified_time" content={article.modifiedTime.toISOString()} />
    )}
    {article.authors?.map(author => (
      <meta property="article:author" content={author} />
    ))}
    {article.tags?.map(tag => (
      <meta property="article:tag" content={tag} />
    ))}
  </>
)}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={ogImage} />
```

### Usage

```astro
---
import SEO from '../components/SEO.astro';
import Layout from '../layouts/Layout.astro';

const post = await getEntry('blog', Astro.params.slug);
---

<html>
  <head>
    <SEO
      title={post.data.title}
      description={post.data.description}
      image={post.data.heroImage}
      article={{
        publishedTime: post.data.pubDate,
        tags: post.data.tags,
      }}
    />
  </head>
  <body>
    <!-- ... -->
  </body>
</html>
```

## Blog Post SEO

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { title, description, pubDate, categories } = post.data;
---

<head>
  <title>{title} | Blog</title>
  <meta name="description" content={description} />

  <!-- Article specific -->
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content={pubDate.toISOString()} />
  {categories.map(cat => (
    <meta property="article:tag" content={cat} />
  ))}

  <!-- Keywords from categories -->
  <meta name="keywords" content={categories.join(', ')} />
</head>
```

## JSON-LD Structured Data

### Organization

```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": Astro.site,
  "logo": `${Astro.site}logo.png`,
  "sameAs": [
    "https://linkedin.com/company/example",
    "https://twitter.com/example"
  ]
})} />
```

### Person (Portfolio/CV)

```astro
---
const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Fabien Salles",
  "url": Astro.site,
  "jobTitle": "Technical Coach",
  "sameAs": [
    "https://linkedin.com/in/fabiensalles",
    "https://github.com/fabiensalles"
  ]
};
---

<script type="application/ld+json" set:html={JSON.stringify(person)} />
```

### Blog Post (Article)

```astro
---
const article = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": post.data.title,
  "description": post.data.description,
  "datePublished": post.data.pubDate.toISOString(),
  "author": {
    "@type": "Person",
    "name": "Fabien Salles"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Fabien Salles",
    "logo": {
      "@type": "ImageObject",
      "url": `${Astro.site}logo.png`
    }
  }
};
---

<script type="application/ld+json" set:html={JSON.stringify(article)} />
```

### Breadcrumbs

```astro
---
const breadcrumbs = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": Astro.site
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": `${Astro.site}blog/`
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": post.data.title
    }
  ]
};
---

<script type="application/ld+json" set:html={JSON.stringify(breadcrumbs)} />
```

## Sitemap Integration

```javascript
// astro.config.mjs
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/draft/'),
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
});
```

## Multilingual SEO

```astro
---
const currentPath = Astro.url.pathname;
const isEnglish = currentPath.startsWith('/en');
const alternateLang = isEnglish ? 'fr' : 'en';
const alternatePath = isEnglish
  ? currentPath.replace('/en', '')
  : `/en${currentPath}`;
---

<head>
  <html lang={isEnglish ? 'en' : 'fr'}>

  <!-- Alternate language versions -->
  <link rel="alternate" hreflang="fr" href={`${Astro.site}${currentPath.replace('/en', '')}`} />
  <link rel="alternate" hreflang="en" href={`${Astro.site}/en${currentPath}`} />
  <link rel="alternate" hreflang="x-default" href={`${Astro.site}${currentPath.replace('/en', '')}`} />
</head>
```

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
