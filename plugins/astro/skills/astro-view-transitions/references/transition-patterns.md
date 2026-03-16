# View Transition Patterns & Examples

## Table of Contents
- [Custom Animations](#custom-animations)
- [Force Full Reload Examples](#force-full-reload-examples)
- [Persist Elements Examples](#persist-elements-examples)
- [Lifecycle Events](#lifecycle-events)
- [Common Layout Patterns](#common-layout-patterns)
- [Loading Indicator Pattern](#loading-indicator-pattern)

## Custom Animations

### Custom Duration

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

## Force Full Reload Examples

### Basic data-astro-reload

```astro
<nav>
  <!-- Normal transition -->
  <a href="/blog">Blog</a>

  <!-- Force full reload -->
  <a href="/" data-astro-reload>Home</a>
  <a href="/en" data-astro-reload>EN</a>
</nav>
```

### Language Switcher with data-astro-reload

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

### Use Cases for data-astro-reload

1. **Language switching** - Reset page state
2. **Theme changes** - Reinitialize styles
3. **Auth state changes** - Clear cached data
4. **External links handled locally** - Full reload needed

## Persist Elements Examples

### Basic Persist

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

### All Navigation Events

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

## Common Layout Patterns

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

## Loading Indicator Pattern

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

### Detect Browser Support

```javascript
const supportsViewTransitions = 'startViewTransition' in document;
```
