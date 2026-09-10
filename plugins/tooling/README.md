# tooling

Cross-stack tooling skills: Docker, Drizzle ORM, pnpm workspaces, Zod schemas.

Skill and plugin authoring conventions moved to [`skills`](../skills/README.md):
`skill-authoring`, `agent-authoring`, `plugin-conventions`.

## Install

```text
/plugin install tooling@fabien-claude-marketplace
```

## Skills (4)

| Skill | Purpose |
|---|---|
| [`docker-integration`](skills/docker-integration/SKILL.md) | Mandatory RTFM checklist before writing `docker-compose` (volumes, ports, env vars, healthchecks, internal architecture), image inspection, common anti-patterns |
| [`drizzle-conventions`](skills/drizzle-conventions/SKILL.md) | Schema with `pgTable`, relations, type inference (`$inferSelect`/`$inferInsert`), Query vs Select vs raw SQL, repository with `toDomain`/`toPersistence`, migrations |
| [`pnpm-workspace`](skills/pnpm-workspace/SKILL.md) | Workspace layout (`packages/shared + apps/api + apps/web`), `workspace:*` protocol, build order (shared first), filtering, shared vs per-package deps |
| [`zod-conventions`](skills/zod-conventions/SKILL.md) | `FooSchema` naming, `packages/shared` location, composition (extend/pick/omit/merge), `z.coerce` for HTTP, NestJS `ZodValidationPipe`, error formatting |

## Scripts

This plugin registers no hook: it ships no `hooks.json`, and installing it wires nothing. The
script below is provided to be wired by hand, in your own settings, if you want it.

| Script | Purpose |
|---|---|
| [`fix-drizzle-journal-timestamp.sh`](hooks/fix-drizzle-journal-timestamp.sh) | `PostToolUse` on `Bash`: after `drizzle-kit generate`, rewrites the last journal entry's `when` so it stays strictly greater than every previous one |
