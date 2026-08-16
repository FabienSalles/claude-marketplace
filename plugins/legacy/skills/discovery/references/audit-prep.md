# Audit-prep mode

Extra pass for `audit-prep` mode, run after Phase 5's base risk register. It does
NOT perform the audit — it builds the dossier that makes the audit fast and
complete, then hands over to the audit skills.

Output: `security-surface.md` in the artifact directory, referenced from the
shared-brain README routing table.

## 1. Input surface inventory

Every path by which external data enters the system, each with its validation
story:

| Vector | Where to look |
|---|---|
| HTTP parameters/bodies | routes + form types / DTO validation (or its absence) |
| File uploads | upload handlers, allowed MIME/extension checks, storage location |
| Webhooks / callbacks | signature verification present? |
| Message consumers | who can publish to the queue? |
| CLI arguments consumed by cron | who writes the files/args cron reads? |
| Third-party API responses | trusted blindly or validated? |

For each vector: entry file, validation mechanism, and a trust rating
(validated / partially / raw).

## 2. Authorization matrix

The single highest-value audit-prep artifact. One row per use case (reuse the
UC-XXX inventory — this is why Phase 3 runs first):

| UC | Route(s) | Required role/voter | Object-level check? | Notes |
|---|---|---|---|---|

"Object-level check?" asks whether a user can reach another user's resource by
swapping an ID (IDOR). Rows where the answer is "role check only" are pre-marked
audit targets.

## 3. Secrets and sensitive data

```bash
# Committed secrets sweep (names/locations only — never echo values;
# truncate to first/last 4 chars if one must be cited)
git ls-files | grep -i -e '\.env' -e 'credential' -e 'secret' -e '\.pem' -e '\.p12' | head
git grep -l -i -e 'password.*=' -e 'api[_-]key' -e 'BEGIN.*PRIVATE KEY' -- ':!vendor' ':!node_modules' ':!*.lock' | head -20
```

Also map where personal data (PII) lives: which entities hold it (cross-check
`entity-model.md`), whether it appears in logs, and any export/erasure mechanism
(GDPR posture).

## 4. Dependency vulnerabilities

```bash
composer audit 2>/dev/null          # PHP (Composer >= 2.4)
npm audit --omit=dev 2>/dev/null    # Node
symfony check:security 2>/dev/null  # Symfony CLI, if present
```

Record counts by severity plus the handful of critical CVEs with the affected
package and the version distance to the fix.

## 5. Configuration posture

Debug mode reachable in prod config, CORS wildcard, cookie flags, missing
security headers, default credentials in seed/fixture files, exposed
`/_profiler`-style tooling routes.

## 6. Hand over to the audit

The audit itself belongs to the audit skills — load them with this dossier in
context:

1. `security-audit:security-audit` — the comprehensive OWASP / CWE / CVSS
   baseline.
2. `audit:security-overrides` — personal scope, false-positive filters, output
   conventions.
3. The stack-specific overlay (`audit:ts-security` for TS/NestJS; the PHP
   checkpoints of the baseline for Symfony).

The dossier's job is done when the auditor never has to ask "where does input
enter?", "who may call this?", or "where is the sensitive data?" — those answers
are already in `security-surface.md`, the authorization matrix, and
`entity-model.md`.
