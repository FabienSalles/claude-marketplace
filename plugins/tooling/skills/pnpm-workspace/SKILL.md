---
name: pnpm-workspace
description: This skill should be used when configuring the monorepo structure, cross-package imports, workspace scripts, or pnpm workspace protocol. Provides pnpm monorepo conventions.
version: "1.0"
---

# pnpm Workspace Conventions

## Structure

```
quittanceme/
├── pnpm-workspace.yaml
├── package.json              # Root scripts, devDependencies
├── packages/
│   └── shared/               # DTOs Zod, enums, types partages
│       ├── package.json
│       └── src/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── package.json
│   │   └── src/
│   └── web/                  # Astro frontend
│       ├── package.json
│       └── src/
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

## workspace:* Protocol

**Use `workspace:*`** for cross-package dependencies:

```jsonc
// apps/api/package.json
{
  "dependencies": {
    "@quittanceme/shared": "workspace:*"
  }
}
```

This resolves to the local package, never fetches from npm.

## Build Order

**`packages/shared` must build before `apps/*`** because apps import from it.

```jsonc
// package.json (root)
{
  "scripts": {
    "build": "pnpm -r --filter=@quittanceme/shared build && pnpm -r --filter=./apps/* build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

## Filtering

```bash
# Run in a specific package
pnpm --filter @quittanceme/shared build
pnpm --filter api test

# Run in all apps
pnpm --filter './apps/*' build

# Run in all packages except one
pnpm --filter '!web' test
```

## Shared Dependencies

**Root `package.json`** for devDependencies shared across all packages (TypeScript, ESLint, Prettier, Vitest):

```jsonc
// package.json (root)
{
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.0",
    "eslint": "^9.0"
  }
}
```

Package-specific dependencies go in each package's `package.json`.

## Imports from Shared

```typescript
// In apps/api or apps/web
import { CreateReceiptSchema, type CreateReceiptDto } from '@quittanceme/shared';
```

> **See also**: `zod-conventions` for how schemas are structured in `packages/shared`.

## Quick Reference

| Rule | Convention |
|------|-----------|
| Workspace config | `pnpm-workspace.yaml` |
| Internal deps | `workspace:*` protocol |
| Build order | `packages/shared` first, then `apps/*` |
| Dev tools | Root devDependencies |
| App-specific deps | Per-package `package.json` |
| Filtering | `pnpm --filter <package>` |
| Parallel dev | `pnpm -r --parallel dev` |
