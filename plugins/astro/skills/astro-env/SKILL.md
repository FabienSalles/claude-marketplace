---
name: astro-env
description: "ACTIVATE when working with environment variables, feature flags, or runtime configuration in Astro. ACTIVATE for 'import.meta.env', '.env', 'PUBLIC_', 'feature flag', 'TRAINING_ENABLED'. Covers: server vs client variables (PUBLIC_ prefix), feature flags pattern with centralized config, TypeScript env declarations, build-time vs runtime variables, Netlify/Vercel deployment vars. DO NOT use for: general Astro setup, content configuration."
version: "1.1"
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

## Server-side vs Client-side

| Pattern | Server | Client | Notes |
|---------|--------|--------|-------|
| `MY_VAR` | Yes | No | Default, secure |
| `PUBLIC_MY_VAR` | Yes | Yes | Exposed in bundle |
| `import.meta.env.PROD` | Yes | Yes | Built-in |
| `process.env.VAR` | Functions only | No | Node.js runtime |

## Built-in Variables

| Variable | Description |
|----------|-------------|
| `import.meta.env.MODE` | `development` or `production` |
| `import.meta.env.PROD` | `true` in production |
| `import.meta.env.DEV` | `true` in development |
| `import.meta.env.SSR` | `true` on server |
| `import.meta.env.SITE` | Site URL from config |
| `import.meta.env.BASE_URL` | Base path from config |

## Defining Variables

```bash
# Server-side only (default)
DATABASE_URL=postgresql://localhost/mydb

# Client-side (PUBLIC_ prefix)
PUBLIC_API_URL=https://api.example.com
```

> **When implementing feature flags with centralized config**, read `references/env-configuration-examples.md` for the complete feature flags pattern with .env files and config.ts.

> **When adding TypeScript declarations for env vars**, read `references/env-configuration-examples.md` for the env.d.ts setup.

> **When deploying to Netlify/Vercel or understanding build-time vs runtime behavior**, read `references/env-configuration-examples.md` for deployment patterns and security best practices.
