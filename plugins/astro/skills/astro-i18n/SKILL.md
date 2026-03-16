---
name: astro-i18n
description: "ACTIVATE when implementing multilingual Astro sites, language switching, translated routes, or translation patterns. ACTIVATE for 'i18n', 'multilingual', 'language switch', 'hreflang', 'translate route', 'getLang'. Covers: prefix-based routing (fr default, /en prefix), route mapping between languages, translation dictionary without external library, multilingual content collections, hreflang SEO tags, language switcher component. DO NOT use for: Astro routing basics (see astro-routing), SEO tags (see astro-seo)."
version: "1.1"
---

# Astro Internationalization (i18n)

Patterns for building multilingual Astro sites without external libraries.

## Route Structure (Prefix-based, recommended)

```
src/pages/
├── index.astro          # / (French default)
├── about.astro          # /about
├── blog/
│   └── [...slug].astro  # /blog/*
└── en/
    ├── index.astro      # /en
    ├── about.astro      # /en/about
    └── blog/
        └── [...slug].astro  # /en/blog/*
```

## Language Detection

### Utility Function

```typescript
// src/utils/i18n.ts
export function getLang(pathname: string): 'fr' | 'en' {
  return pathname.startsWith('/en') ? 'en' : 'fr';
}

export function getLocalizedPath(path: string, lang: 'fr' | 'en'): string {
  const cleanPath = path.replace(/^\/en/, '');
  return lang === 'en' ? `/en${cleanPath}` : cleanPath;
}
```

> **When implementing route mapping between languages** (static or dynamic), read `references/i18n-implementation-patterns.md` for complete mapping implementations.

> **When setting up a translations dictionary** with JSON files and helper functions, read `references/i18n-implementation-patterns.md` for the full dictionary setup and useTranslations pattern.

> **When organizing multilingual content collections** (separate collections, prefixed slugs, or frontmatter-based), read `references/i18n-implementation-patterns.md` for all three approaches.

> **When building a language switcher component** or multilingual navigation, read `references/i18n-implementation-patterns.md` for complete LanguageSwitcher.astro and nav patterns.

## Quick Reference

### URL Patterns

| French | English | Pattern |
|--------|---------|---------|
| `/` | `/en` | Homepage |
| `/blog` | `/en/blog` | Section |
| `/blog/mon-slug` | `/en/blog/my-slug` | Content |
| `/formations` | `/en/training` | Translated route |

### Essential Functions

| Function | Purpose |
|----------|---------|
| `getLang(path)` | Extract language from URL |
| `t(key, lang)` | Get translation |
| `translateRoute(path, lang)` | Convert path to other language |
| `getLocalizedPath(path, lang)` | Add/remove language prefix |

### SEO Tags

| Tag | Purpose |
|-----|---------|
| `<html lang="">` | Document language |
| `hreflang` links | Language alternates |
| `og:locale` | Social sharing language |
| `x-default` | Default/fallback version |
