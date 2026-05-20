---
name: security-overrides
description: "ACTIVATE when conducting a security audit / review / vulnerability assessment on a personal project. Loads alongside netresearch:security-audit (which provides the comprehensive 80+ checkpoint / OWASP / CWE / CVSS baseline). This skill adds personal/project overrides: stack scope (PHP/Symfony + TS/NestJS), false-positive filters, output format conventions, and cross-references to language-specific skills (e.g. audit:ts-security for Drizzle/JWT/bcrypt). DO NOT use as a primary audit skill — it is an overlay only."
version: "1.0"
---

# Security Audit — Personal Overrides

> This skill is an **overlay** on top of `netresearch:security-audit` (the upstream provides OWASP/CWE/CVSS coverage and 61 reference files). Load this skill **in addition** to the upstream — never as a replacement.

## 1. Stack Scope

In-scope (audit findings apply, severity scored normally):

- **Backend**: PHP/Symfony, TypeScript/NestJS
- **Frontend**: React, Astro, Vue (where applicable)
- **DB layer**: Drizzle (TS), Doctrine (PHP)
- **Auth**: JWT (TS), Symfony Security (PHP)
- **Build/CI**: GitHub Actions, Docker

Out-of-scope (findings reported but **deprioritised**):

- Mobile (iOS/Android SDK security refs in netresearch)
- Non-stack frameworks: Django, Flask, FastAPI, Rails, Spring, .NET, Go-Gin
- TYPO3 (specific to netresearch's primary scope, not yours)

## 2. False-Positive Filters

Findings to **automatically downgrade or dismiss** in the audit output, unless explicit evidence shows real impact:

| Category | Reason to downgrade |
|---|---|
| Denial-of-service patterns (unbounded loops, large response) | Handled at infrastructure layer (rate limiting, CDN, K8s resource limits) |
| Rate limiting at application level | Same — infra concern, not code-review concern |
| Generic input validation findings | Only flag if a concrete attack path is identified (not "could be missing") |
| Memory / CPU exhaustion | Infra layer |
| Open redirect (unless on auth flow) | Low impact outside auth context |
| Information disclosure via error messages in DEV environment | Only flag if production |

## 3. Severity Conventions (CVSS-aligned)

Use CVSS v4.0 when scoring. Map to severity buckets:

| Severity | CVSS range | Audit verdict |
|---|---|---|
| **Critical** | 9.0 – 10.0 | Block PR, fix before merge |
| **High** | 7.0 – 8.9 | Fix before merge unless explicit waiver |
| **Medium** | 4.0 – 6.9 | Fix within sprint |
| **Low** | 0.1 – 3.9 | Backlog / track |

## 4. Output Format Convention

When delivering an audit report (Markdown):

```markdown
## Security Audit — <scope>

### Critical (N)
#### F1 — <vuln name>  [CVSS X.Y]
**Location:** `path/to/file.ts:42`
**Description:** <one-line>
**Reproduction:** <minimal proof>
**Fix:** <concrete code change>
**Reference:** <link to netresearch ref or owasp/cwe ID>

### High (N)
…

### Summary
- Total findings: N
- By severity: Critical X, High X, Medium X, Low X
- Recommended action: <one line>
```

No verbose intro. No multi-option matrices. Direct to findings.

## 5. Cross-References to Companion Skills

- **TypeScript-specific patterns** (Drizzle parameterized queries, JWT setup, bcrypt rounds, `execFile` over `exec`, path traversal, Zod env validation, Helmet headers, SameSite cookies) → see `audit:ts-security` (loads automatically in TS context).
- **PHP/Symfony-specific patterns** → see `netresearch:security-audit` references `symfony-security.md`, `php-security-features.md`.
- **NestJS-specific patterns** → see netresearch `nestjs-security.md`.
- **Frontend (React/Vue/Astro)** → see netresearch `react-security.md`, `vue-security.md`, `frontend-security.md`.

## 6. Project-Specific Patterns to Always Check

These are not in netresearch but recur across personal projects:

- **Drizzle parameterized queries everywhere** — never string-interpolate user input into `db.execute(\`...\${var}...\`)`. Use `sql\`SELECT … WHERE x = \${var}\`` with placeholders, or the query builder.
- **bcrypt SALT_ROUNDS ≥ 12** — never lower for production.
- **JWT** with explicit `expiresIn`, strong `JWT_SECRET` (≥ 32 chars), explicit `algorithms: ['HS256']` on verify.
- **Zod env validation at startup** — fail-fast on missing/malformed env vars.
- **Helmet headers** in NestJS/Express apps.
- **`SameSite: 'strict'` + `httpOnly: true` + `secure: true`** on auth cookies.

## Quick Reference

| Override category | Application |
|---|---|
| Stack scope | Focus on PHP/Symfony + TS/NestJS; deprioritise others |
| FP filters | Downgrade DoS, rate limiting, memory/CPU, generic validation, dev-env info disclosure |
| Severity buckets | Critical 9+ / High 7-9 / Medium 4-7 / Low <4 (CVSS v4.0) |
| Output format | Sections by severity, F-N codes, CVSS + location + fix + reference |
| Stack-specific | Drizzle / bcrypt rounds / JWT setup / Zod env / Helmet / SameSite cookies |
