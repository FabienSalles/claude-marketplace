---
name: ts-security-audit
description: This skill should be used when conducting security assessments, identifying vulnerabilities, or CVSS scoring in TypeScript/Node.js projects. Covers OWASP Top 10, CWE Top 25, and Node.js-specific patterns.
version: "1.0"
---

# Security Audit (TypeScript / Node.js)

Security audit patterns for TypeScript/Node.js/NestJS projects.

> **See also**: `php-security-audit` for PHP-specific patterns and the full reference library.

## Standards

- **OWASP Top 10** (2021)
- **CWE Top 25** (2025)
- **CVSS v3.1 / v4.0** for risk scoring

## SQL Injection Prevention

**Always use Drizzle parameterized queries.** Never interpolate user input into SQL.

```typescript
// ❌ AVOID - String interpolation in SQL
const result = await db.execute(
  `SELECT * FROM tenants WHERE email = '${email}'`
);

// ✅ CORRECT - Drizzle parameterized query
const result = await db
  .select()
  .from(tenants)
  .where(eq(tenants.email, email));

// ✅ CORRECT - Raw SQL with placeholder
import { sql } from 'drizzle-orm';
const result = await db.execute(
  sql`SELECT * FROM tenants WHERE email = ${email}`
);
```

## XSS Prevention

```typescript
// ✅ React/JSX auto-escapes by default — safe
return <p>{userInput}</p>;

// ❌ AVOID - Bypasses auto-escaping
return <div dangerouslySetInnerHTML={{ __html: userInput }} />;

// ✅ CORRECT - If HTML rendering needed, sanitize first
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
return <div dangerouslySetInnerHTML={{ __html: clean }} />;
```

## JWT Security

```typescript
// ❌ AVOID - No expiration, weak secret
const token = jwt.sign(payload, 'secret');

// ✅ CORRECT - Strong secret, expiration, algorithm specified
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '1h',
  algorithm: 'HS256',
});

// ✅ CORRECT - Validate with explicit algorithms
const decoded = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256'],
});
```

## Password Hashing

```typescript
import * as bcrypt from 'bcrypt';

// ✅ CORRECT - bcrypt with sufficient rounds
const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);
const isValid = await bcrypt.compare(password, hash);

// ❌ AVOID - MD5, SHA-1, SHA-256 without salt
import { createHash } from 'crypto';
const hash = createHash('sha256').update(password).digest('hex');
```

## Command Injection Prevention

```typescript
// ❌ AVOID - Shell injection via child_process.exec
// exec(`convert ${userInput} output.png`);
// exec() spawns a shell, allowing injection via metacharacters

// ✅ CORRECT - execFile prevents shell injection (no shell involved)
import { execFile } from 'child_process';

execFile('convert', [userInput, 'output.png'], (error, stdout) => {
  // Arguments are passed as array, not interpolated into a shell command
});
```

## Path Traversal Prevention

```typescript
import { resolve, normalize } from 'path';

// ❌ AVOID - User input directly in path
const filePath = `./uploads/${req.params.filename}`;

// ✅ CORRECT - Normalize and verify containment
const UPLOAD_DIR = resolve('./uploads');
const requested = resolve(UPLOAD_DIR, req.params.filename);

if (!requested.startsWith(UPLOAD_DIR)) {
  throw new ForbiddenException('Path traversal detected');
}
```

## Environment & Secrets

```typescript
// ❌ AVOID - Secrets hardcoded
const API_KEY = 'sk-1234567890abcdef';

// ✅ CORRECT - From environment, validated at startup
import { z } from 'zod';

const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(16),
});

const env = EnvSchema.parse(process.env);
```

## CSRF Protection

```typescript
// ✅ NestJS - Use CSRF middleware for state-changing endpoints
// For API-only (JWT auth): CSRF is not needed (no cookies)
// For session-based auth: enable CSRF tokens

// ✅ SameSite cookies
response.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
});
```

## Security Tooling

```bash
# Dependency audit
pnpm audit

# ESLint security rules
pnpm add -D eslint-plugin-security

# Snyk scanning
npx snyk test
```

## Security Checklist

- [ ] bcrypt (12+ rounds) for passwords
- [ ] Drizzle parameterized queries everywhere (no string interpolation)
- [ ] JWT with expiration, strong secret, explicit algorithm
- [ ] No `dangerouslySetInnerHTML` without DOMPurify
- [ ] `execFile` instead of `exec` for system commands
- [ ] Path traversal check on all file operations
- [ ] Secrets in environment variables, validated with Zod at startup
- [ ] `httpOnly`, `secure`, `sameSite: 'strict'` on cookies
- [ ] `pnpm audit` in CI pipeline
- [ ] Security headers (HSTS, CSP, X-Content-Type-Options) via Helmet

## Quick Reference

| Vulnerability | Mitigation |
|--------------|------------|
| SQL Injection | Drizzle queries, `sql` template tag |
| XSS | JSX auto-escaping, DOMPurify if needed |
| JWT flaws | Expiration, strong secret, explicit algorithm |
| Weak passwords | bcrypt 12+ rounds |
| Command injection | `execFile` (no shell) |
| Path traversal | `resolve` + `startsWith` check |
| Secrets in code | Env vars + Zod validation |
| CSRF | SameSite cookies, CSRF tokens for sessions |
