# Content Collection Patterns

## Table of Contents
- [Schema Definition Examples](#schema-definition-examples)
- [Dynamic Routes with Collections](#dynamic-routes-with-collections)
- [Frontmatter and MDX Patterns](#frontmatter-and-mdx-patterns)
- [YAML Meta Files Pattern](#yaml-meta-files-pattern)
- [Rendering Content](#rendering-content)
- [Collection References](#collection-references)

## Schema Definition Examples

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

## Frontmatter and MDX Patterns

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

### With Components and Headings

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
