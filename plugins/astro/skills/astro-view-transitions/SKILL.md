---
name: astro-view-transitions
description: "ACTIVATE when implementing page transitions, SPA-like navigation, transition:persist, or data-astro-reload in Astro. ACTIVATE for 'ViewTransitions', 'transition:name', 'transition:animate', 'data-astro-reload', 'page transition'. Covers: ViewTransitions setup, transition directives (name/animate/persist), custom animations, data-astro-reload for language switching, lifecycle events (astro:page-load), loading indicator pattern. DO NOT use for: general Astro routing, React component hydration."
version: "1.1"
---

# Astro View Transitions

Patterns for smooth page transitions and SPA-like navigation in Astro.

## Setup

Add the `<ViewTransitions />` component to your layout:

```astro
---
import { ViewTransitions } from 'astro:transitions';
---
<html>
  <head>
    <ViewTransitions />
  </head>
  <body><slot /></body>
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
<header transition:name="header">...</header>
<h1 transition:name={`title-${post.slug}`}>{post.data.title}</h1>
```

### `transition:animate` - Animation Type

| Animation | Description |
|-----------|-------------|
| `fade` | Crossfade (default) |
| `slide` | Slide in from side |
| `none` | No animation |
| `initial` | Only animate on first load |

### `transition:persist` - Keep Elements Across Navigations

```astro
<audio transition:persist id="player">...</audio>
<Counter client:load transition:persist initialCount={0} />
```

## Force Full Reload with `data-astro-reload`

Use `data-astro-reload` to force a full page reload on specific links. Use cases: language switching, theme changes, auth state changes.

```astro
<a href="/en" data-astro-reload>EN</a>
```

> **When implementing custom animations, persist patterns, or loading indicators**, read `references/transition-patterns.md` for complete examples with CSS keyframes and lifecycle events.

## Lifecycle Events (in order)

| Event | When |
|-------|------|
| `astro:before-preparation` | Navigation started |
| `astro:after-preparation` | New page fetched |
| `astro:before-swap` | Before DOM swap |
| `astro:after-swap` | After DOM swap |
| `astro:page-load` | Fully complete |

Use `astro:page-load` to re-initialize scripts after navigation.

## Fallback

View Transitions degrade gracefully to full page loads in unsupported browsers.

## Quick Reference

| Directive/Attribute | Purpose |
|---------------------|---------|
| `transition:name` | Identify element for morphing |
| `transition:animate` | Set animation type |
| `transition:persist` | Keep element across navigations |
| `data-astro-reload` | Force full page reload |
| `data-astro-prefetch` | Prefetch on hover/view |
