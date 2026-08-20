# SEO Components & Structured Data

## Table of Contents
- [Reusable SEO Component](#reusable-seo-component)
- [Blog Post SEO Page](#blog-post-seo-page)
- [JSON-LD Structured Data](#json-ld-structured-data)
- [Multilingual SEO](#multilingual-seo)
- [Sitemap Integration](#sitemap-integration)

## Reusable SEO Component

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

## Blog Post SEO Page

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.id },
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

## Multilingual SEO

`astro-i18n` emits the hreflang `<link>` tags. See the "SEO for Multilingual Sites" section of `astro-i18n`'s `references/i18n-implementation-patterns.md` for the full markup, alternate-path computation, and og:locale pairing.

## Sitemap Integration

For `@astrojs/sitemap` setup, page filtering, and multi-language sitemap configuration, see `astro-sitemap`'s `references/sitemap-configuration-examples.md`.
