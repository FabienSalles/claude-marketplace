---
name: astro-i18n
description: This skill should be used when implementing multilingual sites, language switching, route mapping, or translation patterns in Astro. Covers i18n without external libraries.
version: "1.0"
---

# Astro Internationalization (i18n)

Patterns for building multilingual Astro sites without external libraries.

## Route Structure

### Prefix-based (recommended)

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

### Domain-based (alternative)

```
example.fr/        # French
example.com/       # English
```

## Language Detection

### In Layout

```astro
---
// src/layouts/Layout.astro
const currentPath = Astro.url.pathname;
const isEnglish = currentPath.startsWith('/en');
const currentLang = isEnglish ? 'en' : 'fr';
---

<!doctype html>
<html lang={currentLang}>
  <head>
    <!-- ... -->
  </head>
  <body>
    <slot />
  </body>
</html>
```

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

## Route Mapping

### Static Mapping

```astro
---
// src/layouts/Layout.astro
const currentPath = Astro.url.pathname;
const isEnglish = currentPath.startsWith('/en');

const routeMapping: Record<string, string> = {
  '/formations': '/en/training',
  '/en/training': '/formations',
  '/cv': '/en/resume',
  '/en/resume': '/cv',
  '/about': '/en/about',
  '/en/about': '/about',
  '/blog': '/en/blog',
  '/en/blog': '/blog',
  '/contact': '/en/contact',
  '/en/contact': '/contact',
  '/': '/en',
  '/en': '/',
};

let alternateLink = routeMapping[currentPath];

// Handle dynamic routes
if (!alternateLink) {
  if (currentPath.startsWith('/blog/')) {
    alternateLink = '/en' + currentPath;
  } else if (currentPath.startsWith('/en/blog/')) {
    alternateLink = currentPath.replace('/en', '');
  }
}
---

<!-- Language switcher -->
<a href={alternateLink} data-astro-reload>
  {isEnglish ? 'FR' : 'EN'}
</a>
```

### Dynamic Mapping Function

```typescript
// src/utils/i18n.ts
const routeTranslations: Record<string, Record<string, string>> = {
  formations: { en: 'training', fr: 'formations' },
  cv: { en: 'resume', fr: 'cv' },
  about: { en: 'about', fr: 'about' },
  blog: { en: 'blog', fr: 'blog' },
  contact: { en: 'contact', fr: 'contact' },
};

export function translateRoute(path: string, targetLang: 'fr' | 'en'): string {
  const isCurrentlyEnglish = path.startsWith('/en');
  const cleanPath = path.replace(/^\/en/, '');
  const segments = cleanPath.split('/').filter(Boolean);

  const translatedSegments = segments.map(segment => {
    const translation = routeTranslations[segment];
    if (translation) {
      return translation[targetLang];
    }
    return segment; // Keep slugs as-is
  });

  const translatedPath = '/' + translatedSegments.join('/');
  return targetLang === 'en' ? '/en' + translatedPath : translatedPath;
}
```

## Translations Dictionary

### Simple JSON Approach

```json
// src/i18n/fr.json
{
  "nav.home": "Accueil",
  "nav.blog": "Blog",
  "nav.about": "À propos",
  "nav.contact": "Contact",
  "footer.copyright": "Tous droits réservés",
  "blog.readMore": "Lire la suite"
}
```

```json
// src/i18n/en.json
{
  "nav.home": "Home",
  "nav.blog": "Blog",
  "nav.about": "About",
  "nav.contact": "Contact",
  "footer.copyright": "All rights reserved",
  "blog.readMore": "Read more"
}
```

### Translation Helper

```typescript
// src/utils/i18n.ts
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';

const translations = { fr, en };

export function t(key: string, lang: 'fr' | 'en'): string {
  return translations[lang][key] || key;
}

export function useTranslations(lang: 'fr' | 'en') {
  return (key: string) => t(key, lang);
}
```

### Usage in Components

```astro
---
import { useTranslations, getLang } from '../utils/i18n';

const lang = getLang(Astro.url.pathname);
const t = useTranslations(lang);
---

<nav>
  <a href={lang === 'en' ? '/en' : '/'}>{t('nav.home')}</a>
  <a href={lang === 'en' ? '/en/blog' : '/blog'}>{t('nav.blog')}</a>
  <a href={lang === 'en' ? '/en/about' : '/about'}>{t('nav.about')}</a>
</nav>
```

## Multilingual Content Collections

### Separate Collections

```
src/content/
├── blog/           # French posts
│   └── mon-article.md
└── blog-en/        # English posts
    └── my-article.md
```

### Prefixed Slugs (single collection)

```
src/content/blog/
├── fr/
│   └── mon-article.md
└── en/
    └── my-article.md
```

### Frontmatter-based

```markdown
---
title: "Mon article"
lang: "fr"
translationOf: "my-article"  # Link to English version
---
```

```astro
---
const posts = await getCollection('blog');
const frenchPosts = posts.filter(p => p.data.lang === 'fr');
const englishPosts = posts.filter(p => p.data.lang === 'en');
---
```

## SEO for Multilingual

### Hreflang Tags

```astro
---
const currentPath = Astro.url.pathname;
const siteUrl = Astro.site?.toString().replace(/\/$/, '') || '';
const isEnglish = currentPath.startsWith('/en');
const frenchPath = isEnglish ? currentPath.replace('/en', '') || '/' : currentPath;
const englishPath = isEnglish ? currentPath : `/en${currentPath}`;
---

<head>
  <link rel="alternate" hreflang="fr" href={`${siteUrl}${frenchPath}`} />
  <link rel="alternate" hreflang="en" href={`${siteUrl}${englishPath}`} />
  <link rel="alternate" hreflang="x-default" href={`${siteUrl}${frenchPath}`} />
</head>
```

### OG Locale

```astro
<meta property="og:locale" content={isEnglish ? 'en_US' : 'fr_FR'} />
<meta property="og:locale:alternate" content={isEnglish ? 'fr_FR' : 'en_US'} />
```

## Language Switcher Component

```astro
---
// src/components/LanguageSwitcher.astro
import { translateRoute, getLang } from '../utils/i18n';

const currentPath = Astro.url.pathname;
const currentLang = getLang(currentPath);
const targetLang = currentLang === 'fr' ? 'en' : 'fr';
const targetPath = translateRoute(currentPath, targetLang);
---

<a
  href={targetPath}
  class="lang-switch"
  data-astro-reload
  aria-label={targetLang === 'en' ? 'Switch to English' : 'Passer en français'}
>
  {targetLang.toUpperCase()}
</a>

<style>
  .lang-switch {
    @apply px-4 py-2 text-sm font-medium rounded-lg transition-colors;
    @apply hover:bg-gray-100;
  }
</style>
```

## Navigation with Translations

```astro
---
import { getLang, useTranslations } from '../utils/i18n';

const lang = getLang(Astro.url.pathname);
const t = useTranslations(lang);
const prefix = lang === 'en' ? '/en' : '';
---

<nav>
  <ul class="flex gap-6">
    <li><a href={`${prefix}/`}>{t('nav.home')}</a></li>
    <li><a href={`${prefix}/blog`}>{t('nav.blog')}</a></li>
    <li><a href={`${prefix}/${lang === 'en' ? 'training' : 'formations'}`}>
      {t('nav.training')}
    </a></li>
    <li><a href={`${prefix}/contact`}>{t('nav.contact')}</a></li>
  </ul>
</nav>
```

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
