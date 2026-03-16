# Tailwind UI Patterns

## Table of Contents
- [Navigation Header](#navigation-header)
- [Card Component](#card-component)
- [Button Variants](#button-variants)
- [Grid Layouts](#grid-layouts)
- [Form Styling](#form-styling)
- [Typography Plugin Configuration](#typography-plugin-configuration)
- [Dark Mode](#dark-mode)

## Navigation Header

```astro
<header class="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
  <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2">
        <img src="/logo.png" alt="Logo" class="h-8 w-auto" />
        <span class="font-bold text-xl">Brand</span>
      </a>
      <div class="hidden md:flex items-center gap-6">
        <a href="/about" class="text-gray-700 hover:text-primary transition-colors">About</a>
        <a href="/services" class="text-gray-700 hover:text-primary transition-colors">Services</a>
        <a href="/contact" class="bg-primary text-dark px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors">
          Contact
        </a>
      </div>
    </div>
  </nav>
</header>
```

## Card Component

```astro
<article class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
  <img src={image} alt={title} class="w-full h-48 object-cover" />
  <div class="p-6">
    <h3 class="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
    <p class="text-gray-600 line-clamp-2">{description}</p>
  </div>
</article>
```

## Button Variants

```astro
---
interface Props {
  variant?: 'primary' | 'secondary' | 'outline';
  href?: string;
}

const { variant = 'primary', href } = Astro.props;

const baseClasses = 'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300';

const variants = {
  primary: 'bg-primary text-dark hover:bg-secondary shadow-lg hover:shadow-xl',
  secondary: 'bg-gray-900 text-white hover:bg-gray-800',
  outline: 'border-2 border-gray-300 text-gray-700 hover:border-primary hover:text-primary',
};

const classes = `${baseClasses} ${variants[variant]}`;
---

{href ? (
  <a href={href} class={classes}><slot /></a>
) : (
  <button class={classes}><slot /></button>
)}
```

## Grid Layouts

```astro
<!-- 3-column responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card {...item} />)}
</div>

<!-- 2-column with sidebar -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
  <main class="lg:col-span-2">
    <slot />
  </main>
  <aside>
    <Sidebar />
  </aside>
</div>
```

## Form Styling

```astro
<form class="space-y-6">
  <div>
    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
      Email
    </label>
    <input
      type="email"
      id="email"
      name="email"
      required
      class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
      placeholder="you@example.com"
    />
  </div>

  <div>
    <label for="message" class="block text-sm font-medium text-gray-700 mb-1">
      Message
    </label>
    <textarea
      id="message"
      name="message"
      rows="4"
      class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
    ></textarea>
  </div>

  <button type="submit" class="w-full bg-primary text-dark py-3 rounded-lg font-medium hover:bg-secondary transition-colors">
    Send Message
  </button>
</form>
```

## Typography Plugin Configuration

### Prose Usage

```astro
<!-- Markdown content with typography styles -->
<article class="prose prose-lg prose-gray max-w-none">
  <Content />
</article>

<!-- Customized prose -->
<article class="prose prose-headings:text-primary prose-a:text-blue-600 prose-code:bg-gray-100">
  <Content />
</article>
```

### Typography Config

```javascript
// tailwind.config.mjs
plugins: [
  require('@tailwindcss/typography'),
],
theme: {
  extend: {
    typography: {
      DEFAULT: {
        css: {
          maxWidth: '100ch',
          a: {
            color: '#3b82f6',
            '&:hover': {
              color: '#1d4ed8',
            },
          },
        },
      },
    },
  },
},
```

## Dark Mode

### Config

```javascript
// tailwind.config.mjs
export default {
  darkMode: 'class', // or 'media'
  // ...
};
```

### Usage

```astro
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

### CSS Variables with Tailwind

```astro
<style is:global>
  :root {
    --swiper-theme-color: #FFD700;
    --accent-color: theme('colors.primary');
  }
</style>
```

### Mobile-First Responsive Example

```astro
<div class="
  text-sm           /* Mobile default */
  md:text-base      /* Tablet */
  lg:text-lg        /* Desktop */
  px-4              /* Mobile padding */
  md:px-6           /* Tablet padding */
  lg:px-8           /* Desktop padding */
">
  Content
</div>
```
