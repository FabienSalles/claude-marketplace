---
name: astro-view-transitions
description: This skill should be used when implementing page transitions, SPA-like navigation, or the data-astro-reload attribute in Astro. Covers ViewTransitions API integration.
version: "1.0"
---

# Astro View Transitions

Patterns for smooth page transitions and SPA-like navigation in Astro.

## Setup

Add the `<ViewTransitions />` component to your layout:

```astro
---
// src/layouts/Layout.astro
import { ViewTransitions } from 'astro:transitions';
---

<html>
  <head>
    <ViewTransitions />
  </head>
  <body>
    <slot />
  </body>
</html>
```

## How It Works

With View Transitions enabled:
1. User clicks a link
2. Astro fetches the new page in background
3. Browser animates between old and new content
4. URL updates without full page reload

## Transition Directives

### `transition:name` - Identify Elements

```astro
<!-- Header stays in place across pages -->
<header transition:name="header">
  <nav>...</nav>
</header>

<!-- Unique per-page elements -->
<h1 transition:name={`title-${post.slug}`}>
  {post.data.title}
</h1>

<img
  src={post.data.image}
  transition:name={`hero-${post.slug}`}
/>
```

### `transition:animate` - Animation Type

```astro
<!-- Fade in/out (default) -->
<div transition:animate="fade">
  Content
</div>

<!-- Slide from side -->
<aside transition:animate="slide">
  Sidebar
</aside>

<!-- No animation -->
<header transition:animate="none">
  Static header
</header>

<!-- Initial load animation -->
<main transition:animate="initial">
  Page content
</main>
```

### Built-in Animations

| Animation | Description |
|-----------|-------------|
| `fade` | Crossfade (default) |
| `slide` | Slide in from side |
| `none` | No animation |
| `initial` | Only animate on first load |

## Custom Animations

### Define Animation

```astro
---
import { fade, slide } from 'astro:transitions';
---

<!-- Custom duration -->
<div transition:animate={fade({ duration: '0.5s' })}>
  Slow fade
</div>

<!-- Custom slide -->
<aside transition:animate={slide({ duration: '200ms' })}>
  Quick slide
</aside>
```

### Full Custom Animation

```astro
---
const customAnimation = {
  old: {
    name: 'slideOutLeft',
    duration: '0.3s',
    easing: 'ease-in',
  },
  new: {
    name: 'slideInRight',
    duration: '0.3s',
    easing: 'ease-out',
  },
};
---

<main transition:animate={customAnimation}>
  <slot />
</main>

<style is:global>
  @keyframes slideOutLeft {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-100%); opacity: 0; }
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
```

## Force Full Reload

### `data-astro-reload` Attribute

When View Transitions are enabled, use `data-astro-reload` to force a full page reload on specific links:

```astro
<nav>
  <!-- Normal transition -->
  <a href="/blog">Blog</a>

  <!-- Force full reload -->
  <a href="/" data-astro-reload>Home</a>
  <a href="/en" data-astro-reload>EN</a>
</nav>
```

### Use Cases for `data-astro-reload`

1. **Language switching** - Reset page state
2. **Theme changes** - Reinitialize styles
3. **Auth state changes** - Clear cached data
4. **External links handled locally** - Full reload needed

```astro
---
const isEnglish = Astro.url.pathname.startsWith('/en');
---

<!-- Language switcher needs full reload -->
<a
  href={isEnglish ? '/' : '/en'}
  data-astro-reload
  class="lang-switch"
>
  {isEnglish ? 'FR' : 'EN'}
</a>
```

## Persist Elements

Keep elements mounted across navigations:

```astro
<!-- Audio player continues playing -->
<audio transition:persist id="player">
  <source src="/music.mp3" />
</audio>

<!-- Video keeps playing -->
<video transition:persist="video-player">
  <source src="/video.mp4" />
</video>

<!-- Island state preserved -->
<Counter client:load transition:persist initialCount={0} />
```

### Persist with Name

```astro
<!-- Must have same name on both pages -->
<aside transition:persist="sidebar">
  <SidebarContent client:load />
</aside>
```

## Lifecycle Events

### Listen for Navigation

```astro
<script>
  document.addEventListener('astro:before-preparation', (e) => {
    console.log('Starting navigation to:', e.to);
  });

  document.addEventListener('astro:after-preparation', (e) => {
    console.log('New page loaded in background');
  });

  document.addEventListener('astro:before-swap', (e) => {
    console.log('About to swap DOM');
  });

  document.addEventListener('astro:after-swap', (e) => {
    console.log('DOM swapped, animations starting');
  });

  document.addEventListener('astro:page-load', (e) => {
    console.log('Page fully loaded');
    // Re-initialize scripts here
  });
</script>
```

### Re-run Scripts After Navigation

```astro
<script>
  function initAnalytics() {
    // Track page view
    window.dataLayer?.push({
      event: 'page_view',
      page_path: window.location.pathname,
    });
  }

  // Run on initial load and after each navigation
  document.addEventListener('astro:page-load', initAnalytics);
</script>
```

## Common Patterns

### Shared Header/Footer

```astro
---
// Layout.astro
---
<html>
  <head>
    <ViewTransitions />
  </head>
  <body>
    <header transition:animate="none" transition:name="header">
      <nav>...</nav>
    </header>

    <main transition:animate="fade">
      <slot />
    </main>

    <footer transition:animate="none" transition:name="footer">
      ...
    </footer>
  </body>
</html>
```

### Card to Detail Transition

```astro
<!-- Blog list page -->
<article>
  <img
    src={post.image}
    transition:name={`image-${post.slug}`}
  />
  <h2 transition:name={`title-${post.slug}`}>
    {post.title}
  </h2>
</article>

<!-- Blog detail page -->
<article>
  <img
    src={post.image}
    transition:name={`image-${post.slug}`}
  />
  <h1 transition:name={`title-${post.slug}`}>
    {post.title}
  </h1>
</article>
```

### Loading Indicator

```astro
<style is:global>
  /* Show during navigation */
  .loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 3px;
    background: linear-gradient(to right, #3b82f6, #8b5cf6);
    z-index: 9999;
    transition: width 0.2s;
  }

  .loading-bar.active {
    width: 90%;
  }
</style>

<div class="loading-bar" id="loading-bar"></div>

<script>
  const bar = document.getElementById('loading-bar');

  document.addEventListener('astro:before-preparation', () => {
    bar?.classList.add('active');
  });

  document.addEventListener('astro:after-swap', () => {
    if (bar) {
      bar.style.width = '100%';
      setTimeout(() => {
        bar.classList.remove('active');
        bar.style.width = '0';
      }, 200);
    }
  });
</script>
```

## Fallback for No Support

View Transitions degrade gracefully to full page loads in unsupported browsers.

### Detect Support

```javascript
const supportsViewTransitions = 'startViewTransition' in document;
```

## Quick Reference

### Directives

| Directive | Purpose |
|-----------|---------|
| `transition:name` | Identify element for morphing |
| `transition:animate` | Set animation type |
| `transition:persist` | Keep element across navigations |

### Attributes

| Attribute | Purpose |
|-----------|---------|
| `data-astro-reload` | Force full page reload |
| `data-astro-prefetch` | Prefetch on hover/view |

### Events (in order)

| Event | When |
|-------|------|
| `astro:before-preparation` | Navigation started |
| `astro:after-preparation` | New page fetched |
| `astro:before-swap` | Before DOM swap |
| `astro:after-swap` | After DOM swap |
| `astro:page-load` | Fully complete |

### Animation Values

| Value | Effect |
|-------|--------|
| `fade` | Crossfade (default) |
| `slide` | Slide from side |
| `none` | Instant, no animation |
| `initial` | Only on first load |
| `{old: {...}, new: {...}}` | Custom keyframes |
