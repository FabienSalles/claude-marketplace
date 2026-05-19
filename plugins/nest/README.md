# nest

NestJS architectural conventions with a hexagonal/DDD layout.

## Install

```text
/plugin install nest@fabien-claude-marketplace
```

Or `./setup.sh --pack nest` (dev mode).

## Skills (2)

| Skill | Purpose |
|---|---|
| [`nest-conventions`](skills/nest-conventions/SKILL.md) | Module-per-bounded-context structure, thin controllers, `ZodValidationPipe`, guards for auth, exception filters, Symbol-token DI for interfaces |
| [`nest-ddd-conventions`](skills/nest-ddd-conventions/SKILL.md) | Strict domain layer purity (no decorators/ORM/HTTP), `domain/application/infrastructure` directories, ports and adapters with Symbol tokens |
