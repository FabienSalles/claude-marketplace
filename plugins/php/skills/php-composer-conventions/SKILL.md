---
name: php-composer-conventions
description: This skill should be used when modifying composer.json, adding or updating dependencies, or running composer commands. Provides versioning conventions and update strategies.
version: "1.0"
---

# Composer Conventions

## Versioning Rules

### Constraint Format

**Always use caret (`^`) with minor version**:

```json
"vendor/package": "^1.2"
```

This allows patch updates (1.2.x) and minor updates (1.x) but blocks major updates (2.x).

### Forbidden Patterns

| Pattern | Reason |
|---------|--------|
| `"*"` | No version control, can break on any update |
| `"dev-master"` | Unstable, no reproducibility (external packages) |
| `"1.2.3"` | Too strict, blocks security patches |
| `">=1.0"` | Too permissive, allows breaking changes |

### Allowed Exception

`"dev-main as x.y.z"` is allowed **only for internal packages** (`acme/*`) during active development:

```json
"acme/ui-bundle": "dev-main as 0.1.0"
```

## Update Commands

### Standard Update

Always try without `--with-all-dependencies` first:

```bash
composer update vendor/package
```

### With Dependencies (last resort)

Only use if the standard update fails due to dependency conflicts:

```bash
composer update vendor/package --with-all-dependencies
```

## Adding a New Package

1. Find the latest stable version
2. Use `^` with the minor version

```bash
# Check available versions
composer show vendor/package --all

# Add with correct constraint
composer require vendor/package:^1.2
```

## Fixing a Wildcard Version

When encountering `"*"` in composer.json:

1. Check current installed version: `composer show vendor/package`
2. Check latest available: `composer show vendor/package --all`
3. Replace `"*"` with `"^X.Y"` (latest minor)
4. Run `composer update vendor/package`

## Quick Reference

| Situation | Action |
|-----------|--------|
| New dependency | `composer require vendor/package:^X.Y` |
| Update single package | `composer update vendor/package` |
| Fix `"*"` constraint | Replace with `"^X.Y"`, then update |
| Dependency conflict | Only then use `--with-all-dependencies` |
