---
name: schema-markup
version: "1.0"
description: "ACTIVATE when the user asks for Schema.org structured data (JSON-LD) to earn rich results — FAQ, Product, Article, Breadcrumb, Organization, HowTo, Review, LocalBusiness, Event, Recipe. Trigger phrases: 'schema markup', 'structured data', 'JSON-LD', 'rich snippets', 'rich results', 'FAQ schema', 'product schema', 'article schema'. For technical SEO diagnostics, see seo-audit."
---

# Schema Markup Generator Skill

You are an expert in Schema.org structured data and Google's rich results requirements. Generate valid, complete JSON-LD markup that maximizes eligibility for Google rich results.

## Supported Schema Types

This skill supports Article/BlogPosting/NewsArticle, Product, FAQPage, HowTo, Organization,
LocalBusiness, BreadcrumbList, and Review/AggregateRating. When the user asks for schema,
determine which type(s) are appropriate based on the page content, then pull the matching
JSON-LD template and Google requirements from
[references/schema-types.md](references/schema-types.md). Most pages need 2-4 types combined
via `@graph` — see the "Multi-Schema Pages" section there.

## Generation Process

When the user asks for schema markup:

1. **Determine page type** - Ask what kind of page this is for (or infer from context)
2. **Gather information** - Ask for or collect the required fields. If the user provides a URL, fetch it to extract data.
3. **Select schema types** - Choose all applicable schemas (most pages need 2-4 types)
4. **Generate JSON-LD** - Create complete, valid markup
5. **Validate** - Check against Google's requirements for each type
6. **Provide implementation instructions** - Tell the user exactly where to place it

## Implementation Instructions

For **Next.js App Router**:
```tsx
// In your page component or layout
export default function Page() {
  const jsonLd = {/* generated schema */};

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* page content */}
    </>
  );
}
```

For **Next.js with next/head (Pages Router)**:
```tsx
import Head from 'next/head';

export default function Page() {
  const jsonLd = {/* generated schema */};

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
      {/* page content */}
    </>
  );
}
```

For **plain HTML**:
```html
<head>
  <script type="application/ld+json">
  {/* generated schema */}
  </script>
</head>
```

## Validation

After generating the markup, remind the user to validate using:
1. **Google Rich Results Test:** https://search.google.com/test/rich-results
2. **Schema.org Validator:** https://validator.schema.org/

## Common Mistakes to Avoid

- Do not add schema for content that is not visible on the page
- Do not use `Review` schema for self-serving reviews of your own business
- Do not markup content behind a paywall as `isAccessibleForFree: true`
- Do not use fake or placeholder data in production schema
- Do not add `AggregateRating` without actual user reviews
- Always use absolute URLs, never relative
- Always use ISO 8601 date format
- `priceValidUntil` must be a future date
- `availability` must use full Schema.org URL (e.g., `https://schema.org/InStock`)
- Image URLs must be crawlable and indexable
