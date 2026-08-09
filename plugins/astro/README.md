# astro

Astro 5.x conventions: components, routing, content collections, i18n, SEO, Tailwind, React islands, view transitions, environment, analytics.

## Install

```text
/plugin install astro@fabien-claude-marketplace
```

## Skills (11)

### Components & layouts

| Skill | Purpose |
|---|---|
| [`astro-basics`](skills/astro-basics/SKILL.md) | Component anatomy (frontmatter/template/style/script), layout + slot pattern, scoped vs global styles, path aliases |
| [`astro-react`](skills/astro-react/SKILL.md) | `client:load`/`idle`/`visible`/`media`/`only` selection, props passing, MDX integration, nanostores for cross-island state |
| [`astro-tailwind`](skills/astro-tailwind/SKILL.md) | Tailwind 4 CSS-first config (`@theme`), common UI patterns (cards/nav/forms/grids), typography plugin, responsive, dark mode |
| [`astro-view-transitions`](skills/astro-view-transitions/SKILL.md) | `ClientRouter` setup, `transition:name`/`animate`/`persist`, `data-astro-reload`, lifecycle events, loading indicator |

### Routing & content

| Skill | Purpose |
|---|---|
| [`astro-routing`](skills/astro-routing/SKILL.md) | File-based routing, dynamic/catch-all routes, built-in pagination, API routes (JSON/RSS), URL utilities, redirects |
| [`astro-content-collections`](skills/astro-content-collections/SKILL.md) | Collection schemas with Zod, queries, dynamic routes via `getStaticPaths`, YAML meta files, MDX with components |

### SEO, i18n & runtime

| Skill | Purpose |
|---|---|
| [`astro-seo`](skills/astro-seo/SKILL.md) | Reusable SEO component, Open Graph/Twitter meta, JSON-LD (Organization/Person/BlogPosting/Breadcrumbs), hreflang |
| [`astro-sitemap`](skills/astro-sitemap/SKILL.md) | `@astrojs/sitemap` setup, page filtering, custom priority/changefreq, multi-language sitemap with hreflang, robots.txt |
| [`astro-i18n`](skills/astro-i18n/SKILL.md) | Prefix-based routing (default + `/en`), route mapping, dictionary without external lib, multilingual collections, language switcher |
| [`astro-env`](skills/astro-env/SKILL.md) | Server vs client variables (`PUBLIC_` prefix), feature flags with centralized config, TypeScript env declarations, build-time vs runtime |
| [`astro-partytown`](skills/astro-partytown/SKILL.md) | Partytown setup, GA4/GTM/Facebook Pixel integration, forward configuration, conditional loading, cookie consent, debug mode |
