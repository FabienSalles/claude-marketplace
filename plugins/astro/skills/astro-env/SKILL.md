---
name: astro-env
description: This skill should be used when working with environment variables in Astro, feature flags, or runtime configuration. Covers import.meta.env patterns and .env files.
version: "1.0"
---

# Astro Environment Variables

Patterns for configuration and feature flags in Astro projects.

## File Structure

```
project/
├── .env                  # Default (all environments)
├── .env.local            # Local overrides (gitignored)
├── .env.development      # Dev server only
├── .env.production       # Build only
└── .env.example          # Template for team
```

## Loading Priority

1. `.env.{mode}.local` (highest)
2. `.env.{mode}`
3. `.env.local`
4. `.env` (lowest)

Where `mode` is `development` or `production`.

## Defining Variables

### Server-side Only (default)

```bash
# .env
DATABASE_URL=postgresql://localhost/mydb
API_SECRET=super-secret-key
```

Access in frontmatter:
```astro
---
const dbUrl = import.meta.env.DATABASE_URL;
---
```

### Client-side (PUBLIC_ prefix)

```bash
# .env
PUBLIC_API_URL=https://api.example.com
PUBLIC_ANALYTICS_ID=UA-12345
```

Access anywhere (including client scripts):
```astro
<script>
  const apiUrl = import.meta.env.PUBLIC_API_URL;
</script>
```

## Built-in Variables

| Variable | Description |
|----------|-------------|
| `import.meta.env.MODE` | `development` or `production` |
| `import.meta.env.PROD` | `true` in production |
| `import.meta.env.DEV` | `true` in development |
| `import.meta.env.SSR` | `true` on server |
| `import.meta.env.SITE` | Site URL from config |
| `import.meta.env.BASE_URL` | Base path from config |

## Feature Flags Pattern

### .env Configuration

```bash
# .env.development
TRAINING_ENABLED=true
CONTACT_ENABLED=true
CV_ENABLED=true
ABOUT_ENABLED=true

# .env.production
TRAINING_ENABLED=true
CONTACT_ENABLED=false
CV_ENABLED=true
ABOUT_ENABLED=true
```

### Usage in Layout

```astro
---
const trainingEnabled = import.meta.env.TRAINING_ENABLED === 'true';
const contactEnabled = import.meta.env.CONTACT_ENABLED === 'true';
const cvEnabled = import.meta.env.CV_ENABLED === 'true';
---

<nav>
  <a href="/blog">Blog</a>
  {trainingEnabled && <a href="/formations">Formations</a>}
  {cvEnabled && <a href="/cv">CV</a>}
  {contactEnabled && <a href="/contact">Contact</a>}
</nav>
```

### Centralized Config

```typescript
// src/config.ts
export const config = {
  features: {
    training: import.meta.env.TRAINING_ENABLED === 'true',
    contact: import.meta.env.CONTACT_ENABLED === 'true',
    cv: import.meta.env.CV_ENABLED === 'true',
    about: import.meta.env.ABOUT_ENABLED === 'true',
    translation: import.meta.env.TRANSLATION_ENABLED === 'true',
  },
  analytics: {
    googleId: import.meta.env.GOOGLE_ANALYTICS_ID,
  },
  api: {
    baseUrl: import.meta.env.PUBLIC_API_URL,
  },
} as const;
```

```astro
---
import { config } from '../config';
---

{config.features.training && <TrainingSection />}
```

## TypeScript Support

### Type Declarations

```typescript
// src/env.d.ts
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly API_SECRET: string;
  readonly PUBLIC_API_URL: string;
  readonly TRAINING_ENABLED: string;
  readonly CONTACT_ENABLED: string;
  readonly GOOGLE_ANALYTICS_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Netlify/Vercel Environment

### Netlify Functions

```typescript
// netlify/functions/api.ts
export async function handler() {
  // Use process.env in Netlify Functions
  const secret = process.env.API_SECRET;

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
}
```

### Deployment Variables

Set in platform dashboard or `netlify.toml`:

```toml
# netlify.toml
[build.environment]
  NODE_VERSION = "18"

[context.production.environment]
  TRAINING_ENABLED = "true"

[context.deploy-preview.environment]
  TRAINING_ENABLED = "false"
```

## Runtime vs Build-time

### Build-time (default)

Variables are inlined at build:
```astro
---
// This value is baked into the HTML at build
const apiUrl = import.meta.env.PUBLIC_API_URL;
---
<p>API: {apiUrl}</p>
```

### Runtime (SSR mode)

With `output: 'server'`, variables are read at request time:
```javascript
// astro.config.mjs
export default defineConfig({
  output: 'server',
});
```

## Security Best Practices

1. **Never expose secrets to client**
   ```bash
   # WRONG - exposed to browser
   PUBLIC_API_SECRET=secret

   # RIGHT - server only
   API_SECRET=secret
   ```

2. **Validate required variables**
   ```typescript
   // src/config.ts
   function requireEnv(key: string): string {
     const value = import.meta.env[key];
     if (!value) {
       throw new Error(`Missing required env var: ${key}`);
     }
     return value;
   }

   export const config = {
     databaseUrl: requireEnv('DATABASE_URL'),
   };
   ```

3. **Use .env.example for documentation**
   ```bash
   # .env.example
   DATABASE_URL=postgresql://user:pass@localhost/db
   API_SECRET=your-secret-here
   PUBLIC_API_URL=https://api.example.com
   TRAINING_ENABLED=true
   ```

## Quick Reference

| Pattern | Server | Client | Notes |
|---------|--------|--------|-------|
| `MY_VAR` | Yes | No | Default, secure |
| `PUBLIC_MY_VAR` | Yes | Yes | Exposed in bundle |
| `import.meta.env.PROD` | Yes | Yes | Built-in |
| `process.env.VAR` | Functions only | No | Node.js runtime |
