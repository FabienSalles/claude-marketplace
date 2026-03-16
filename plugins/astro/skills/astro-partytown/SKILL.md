---
name: astro-partytown
description: "ACTIVATE when integrating third-party scripts (Google Analytics, GTM, Facebook Pixel) in Astro via Partytown web worker. ACTIVATE for 'analytics', 'Partytown', 'GA4', 'GTM', 'tracking script', 'text/partytown'. Covers: Partytown setup, GA4/GTM/Facebook Pixel integration, forward configuration, custom events, conditional loading (prod only), cookie consent integration, debug mode. DO NOT use for: general script handling in Astro, SEO configuration."
version: "1.1"
---

# Astro + Partytown

Patterns for offloading third-party scripts to a web worker for better performance.

## Why Partytown?

Third-party scripts (analytics, ads, chat widgets) block the main thread and slow page interactivity. Partytown runs them in a web worker, keeping the main thread free.

## Setup

```bash
npx astro add partytown
```

```javascript
// astro.config.mjs
import partytown from '@astrojs/partytown';

export default defineConfig({
  integrations: [
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
});
```

## Key Concepts

Scripts use `type="text/partytown"` and `is:inline` to run in the web worker. The `forward` array tells Partytown which functions to proxy from main thread to worker.

### Forward Configuration

```javascript
partytown({
  config: {
    forward: [
      'dataLayer.push',      // Google Analytics/GTM
      'fbq',                 // Facebook Pixel
      'gtag',                // Google gtag
      '_hsq.push',           // HubSpot
    ],
  },
}),
```

> **When integrating GA4, GTM, or Facebook Pixel**, read `references/analytics-integration-examples.md` for complete setup snippets with Partytown.

> **When implementing custom events, conditional loading, or cookie consent**, read `references/analytics-integration-examples.md` for React component events, production-only loading, and consent patterns.

> **When debugging Partytown issues** (scripts not running, CORS errors), read `references/analytics-integration-examples.md` for troubleshooting steps.

## Quick Reference

| Script Type | Forward Config | Notes |
|-------------|----------------|-------|
| GA4 | `dataLayer.push` | Most common |
| GTM | `dataLayer.push` | Same as GA4 |
| Facebook | `fbq` | Single function |
| HubSpot | `_hsq.push` | Array-based |
| Intercom | `Intercom` | Object-based |
| Custom | Add to `forward` | Any global function |

### Key Attributes

| Attribute | Purpose |
|-----------|---------|
| `type="text/partytown"` | Run in web worker |
| `is:inline` | Don't bundle, keep inline |
| `define:vars={{ }}` | Pass Astro vars to script |
