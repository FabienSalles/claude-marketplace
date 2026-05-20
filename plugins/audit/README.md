# audit

Personal **audit overlay** that complements upstream audit skills without modifying them.

## Pattern — overlay, not replacement

The community provides comprehensive audit skills (e.g. [`netresearch/security-audit-skill`](https://github.com/netresearch/security-audit-skill) — 61 reference files covering OWASP, CWE, CVSS, Symfony, NestJS, etc.). This plugin **does not duplicate** that content. Instead, it provides a **thin overlay** of personal/project-specific overrides:

- Stack scoping (which languages/frameworks are in scope)
- False-positive filters specific to your projects
- Output format and severity conventions
- Cross-references to other skills (e.g. `ts-security-audit` for Drizzle/JWT TS patterns)

When you ask for a security audit, **both** load in parallel:

```
🔵 netresearch:security-audit         → 80+ checkpoints, OWASP/CWE/CVSS, 61 refs
🟢 audit:security-overrides           → your conventions, FP filters, output style
🟢 typescript:ts-security-audit       → loads automatically in TS context
```

Upstream can ship 100 updates — your overlay stays untouched. Run `claude plugin update security-audit` to sync upstream.

## What's included

| Skill | Status |
|---|---|
| `security-overrides` | ✓ shipped (overlay for netresearch/security-audit) |
| `dependency-audit` | _planned (overrides for SCA / npm audit / composer audit)_ |
| `accessibility-audit` | _planned (a11y / WCAG overrides)_ |

## Required upstream

For the security overlay to be useful, install:

```
/plugin install security-audit@fabien-claude-marketplace
```

(Referenced in this marketplace's `marketplace.json` as a re-export of `netresearch/security-audit-skill`.)
