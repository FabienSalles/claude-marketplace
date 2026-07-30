# Schema Type Definitions

Full JSON-LD templates and Google requirements for each supported schema type, plus how to
combine them on one page.

## Table of Contents

1. [Article / BlogPosting / NewsArticle](#1-article--blogposting--newsarticle)
2. [Product](#2-product)
3. [FAQPage](#3-faqpage)
4. [HowTo](#4-howto)
5. [Organization](#5-organization)
6. [LocalBusiness](#6-localbusiness)
7. [BreadcrumbList](#7-breadcrumblist)
8. [Review / AggregateRating](#8-review--aggregaterating)
9. [Multi-Schema Pages](#multi-schema-pages)

### 1. Article / BlogPosting / NewsArticle

**Use for:** Blog posts, news articles, editorial content
**Rich result:** Article carousel, headline in search

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title (max 110 characters)",
  "description": "Brief description of the article (max 160 characters)",
  "image": ["https://example.com/image-16x9.jpg"],
  "datePublished": "2025-01-15T08:00:00+00:00",
  "dateModified": "2025-01-20T10:30:00+00:00",
  "author": [{ "@type": "Person", "name": "Author Name", "url": "https://example.com/author/name" }],
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png", "width": 600, "height": 60 }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://example.com/article-url" }
}
```

**Google requirements:**
- `headline` is required (max 110 characters)
- `image` is required (provide 3 aspect ratios: 16:9, 4:3, 1:1; each > 696px wide)
- `datePublished` is required (ISO 8601 format)
- `author.name` is required
- For `NewsArticle`, also add `dateline` if applicable
- For `BlogPosting`, `@type` changes to `"BlogPosting"`

---

### 2. Product

**Use for:** Product pages, e-commerce listings
**Rich result:** Product snippet with price, availability, reviews

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "image": ["https://example.com/product-1.jpg"],
  "sku": "SKU-12345",
  "brand": { "@type": "Brand", "name": "Brand Name" },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/product",
    "priceCurrency": "USD",
    "price": "99.99",
    "priceValidUntil": "2025-12-31",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "bestRating": "5", "ratingCount": "142" },
  "review": [{
    "@type": "Review",
    "author": { "@type": "Person", "name": "Reviewer Name" },
    "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" }
  }]
}
```

**Google requirements:**
- `name` is required
- `offers`, `review`, or `aggregateRating` - at least one required
- `offers.price` and `offers.priceCurrency` required if offers present
- `offers.availability` must use Schema.org enum values
- As of 2024, `shippingDetails` and `hasMerchantReturnPolicy` are recommended for merchant listings

---

### 3. FAQPage

**Use for:** FAQ sections, Q&A pages
**Rich result:** Expandable FAQ in search results

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the first question?",
      "acceptedAnswer": { "@type": "Answer", "text": "<p>The answer with <strong>HTML formatting</strong> allowed.</p>" }
    }
  ]
}
```

**Google requirements:**
- Each `Question` must have exactly one `acceptedAnswer`
- Answer `text` can include HTML: `<h2>` through `<h6>`, `<br>`, `<ol>`, `<ul>`, `<li>`, `<a>`, `<p>`, `<b>`, `<strong>`, `<i>`, `<em>`
- Must be visible on the page (not hidden behind tabs/accordions without proper implementation)
- Google may show up to 3 FAQ rich results per page
- Do not use for advertising purposes

---

### 4. HowTo

**Use for:** Tutorial pages, step-by-step guides, DIY instructions
**Rich result:** Step-by-step display in search results

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Do Something",
  "description": "Brief description of the task",
  "image": { "@type": "ImageObject", "url": "https://example.com/howto-main.jpg" },
  "totalTime": "PT30M",
  "supply": [{ "@type": "HowToSupply", "name": "Supply item 1" }],
  "tool": [{ "@type": "HowToTool", "name": "Tool 1" }],
  "step": [
    { "@type": "HowToStep", "name": "Step 1 Title", "text": "Detailed instructions for step 1.", "url": "https://example.com/howto#step1" },
    { "@type": "HowToStep", "name": "Step 2 Title", "text": "Detailed instructions for step 2.", "url": "https://example.com/howto#step2" }
  ]
}
```

**Google requirements:**
- `name` is required
- `step` array is required with at least one step
- Each step needs either `text` or `itemListElement` with `HowToDirection`/`HowToTip`
- `totalTime` uses ISO 8601 duration format (PT1H30M = 1 hour 30 minutes)
- Do not use HowTo for recipes (use Recipe schema instead)

---

### 5. Organization

**Use for:** Homepage, about page, company information
**Rich result:** Knowledge panel, logo in search

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com",
  "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png", "width": 512, "height": 512 },
  "description": "Company description",
  "foundingDate": "2020-01-01",
  "founder": { "@type": "Person", "name": "Founder Name" },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "San Francisco",
    "addressRegion": "CA",
    "postalCode": "94102",
    "addressCountry": "US"
  },
  "sameAs": ["https://twitter.com/company", "https://linkedin.com/company/company"]
}
```

---

### 6. LocalBusiness

**Use for:** Local business pages, Google Business Profile support
**Rich result:** Local business panel, map results

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://example.com/#business",
  "name": "Business Name",
  "url": "https://example.com",
  "telephone": "+1-555-555-5555",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "San Francisco",
    "addressRegion": "CA",
    "postalCode": "94102",
    "addressCountry": "US"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": "37.7749", "longitude": "-122.4194" },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "opens": "09:00", "closes": "17:00" }
  ],
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.7", "bestRating": "5", "ratingCount": "312" }
}
```

**Google requirements:**
- `name`, `address` are required
- Use specific subtypes when possible: `Restaurant`, `Dentist`, `LegalService`, `RealEstateAgent`, etc.
- `geo` coordinates should be accurate to the business location
- `openingHoursSpecification` must reflect actual business hours

---

### 7. BreadcrumbList

**Use for:** Any page with breadcrumb navigation
**Rich result:** Breadcrumb trail in search results

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category" },
    { "@type": "ListItem", "position": 3, "name": "Current Page Title" }
  ]
}
```

**Google requirements:**
- `position` must be sequential starting at 1
- Last item should not have `item` (it's the current page)
- Must match the visible breadcrumb on the page

---

### 8. Review / AggregateRating

**Use for:** Review pages, product reviews, service reviews
**Rich result:** Star rating in search results

```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "name": "Review Title",
  "reviewBody": "Full review text...",
  "datePublished": "2025-01-15",
  "author": { "@type": "Person", "name": "Reviewer Name" },
  "itemReviewed": { "@type": "Product", "name": "Product Being Reviewed" },
  "reviewRating": { "@type": "Rating", "ratingValue": "4", "bestRating": "5", "worstRating": "1" },
  "publisher": { "@type": "Organization", "name": "Review Site Name" }
}
```

**Google requirements:**
- `author` is required (must be a valid `Person` or `Organization`)
- `itemReviewed` is required
- `reviewRating` is recommended
- Self-serving reviews (reviewing your own product) are against guidelines

## Multi-Schema Pages

Most pages need multiple schema types. Combine them using `@graph`:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://example.com/#organization", "name": "Company Name", "url": "https://example.com" },
    { "@type": "WebPage", "@id": "https://example.com/page/#webpage", "url": "https://example.com/page/", "name": "Page Title" },
    {
      "@type": "Article",
      "mainEntityOfPage": { "@id": "https://example.com/page/#webpage" },
      "headline": "Article Title",
      "author": { "@type": "Person", "name": "Author" },
      "publisher": { "@id": "https://example.com/#organization" },
      "datePublished": "2025-01-15"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
        { "@type": "ListItem", "position": 2, "name": "Article Title" }
      ]
    }
  ]
}
```
