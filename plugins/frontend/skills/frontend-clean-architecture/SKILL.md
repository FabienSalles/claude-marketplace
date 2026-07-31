---
name: frontend-clean-architecture
description: "ACTIVATE when creating or modifying frontend features in projects with domain/infrastructure layered architecture. ACTIVATE for 'frontend architecture', 'domain layer', 'hexagonal frontend', 'features/ folder', 'repository interface', 'mapper'. Covers: features/<feature>/domain + infrastructure structure, strict dependency direction (domain never imports infrastructure), domain models/repositories/services/referentials, API repositories, mappers, hooks as orchestrators. DO NOT use for: projects without this architecture (ask user first), general React patterns (see frontend-component-patterns)."
version: "1.1"
---

# Frontend Clean Architecture

Apply only on projects that already have a `features/<feature>/domain/` + `infrastructure/` structure. If the project does not use this architecture, ask the user before applying these patterns.

## Architecture

```
src/
├── features/
│   └── <feature>/
│       ├── domain/                  ← PURE: no React/Astro/fetch imports
│       │   ├── <feature>.model.ts       types/interfaces for the domain
│       │   ├── <feature>.repository.ts  SPI (interface) for data access
│       │   ├── <feature>.service.ts     pure business logic (validation, calculations)
│       │   └── referentials/            constants and option lists
│       └── infrastructure/          ← IMPURE: external dependencies
│           ├── api/                     repository implementations (fetch)
│           ├── mappers/                 API ↔ domain transformations
│           ├── hooks/                   React orchestration (state + side-effects)
│           └── components/              React components (Container + Presentation)
├── shared/
│   ├── domain/                      cross-cutting types and errors (ApiError)
│   └── infrastructure/
│       └── components/              reusable UI components (Button, Input, Select)
├── pages/                           Astro pages
├── layouts/                         Astro layouts
└── styles/                          global CSS + tokens
```

## Rules

### Dependency Direction

The domain layer stays testable without mocks and portable across frameworks only if it never depends on how data is fetched or rendered. So the dependency arrow points one way:

- `domain/` never imports from `infrastructure/`, React, Astro, or any external library — importing any of them would make domain logic depend on a rendering or fetching concern it doesn't need to know about
- `infrastructure/` can import from `domain/` — it implements the interfaces and consumes the pure logic the domain defines
- `shared/domain/` never imports from `infrastructure/`, for the same reason as `domain/`
- Verify this direction on every change: a violation here is what turns the architecture back into a tangle

### Domain Layer (`domain/`)

- **Models** (`<feature>.model.ts`): TypeScript types and interfaces describing domain concepts. No classes, no decorators, no framework types.
- **Repository interfaces** (`<feature>.repository.ts`): SPI (Service Provider Interface) — the domain defines WHAT data access it needs, not HOW. Uses `Promise` (standard JS, not a framework dependency).
- **Services** (`<feature>.service.ts`): Pure functions only. No `fetch`, no `useState`, no side-effects. Input → output. Testable without mocks.
- **Referentials** (`referentials/*.referentials.ts`): Constants and generator functions for option lists. A hardcoded list like `YEARS = [2026, 2025, 2024]` goes stale the day it ships; a generator function like `getYearOptions()` derives it from the current date instead.

### Infrastructure Layer (`infrastructure/`)

- **API** (`api/<feature>.api-repository.ts`): Implements the repository interface from domain. Contains `fetch` calls, error handling, HTTP concerns.
- **Mappers** (`mappers/<feature>.mapper.ts`): The ONLY place where API types ↔ domain types transformation happens. Never transform inline in components or hooks.
- **Hooks** (`hooks/use<Feature>.ts`): Orchestrate React state + domain services + repository calls. This is the "glue" between pure domain and impure React.
- **Components** (`components/`): Follow Container/Presentation pattern (see frontend-component-patterns skill).

### Naming Conventions

| File | Pattern | Example |
|------|---------|---------|
| Model | `<feature>.model.ts` | `receipt-form.model.ts` |
| Repository interface | `<feature>.repository.ts` | `receipt.repository.ts` |
| Service | `<concern>.service.ts` | `period.service.ts` |
| Referential | `<concern>.referentials.ts` | `payment.referentials.ts` |
| API repository | `<feature>.api-repository.ts` | `receipt.api-repository.ts` |
| Mapper | `<feature>.mapper.ts` | `receipt.mapper.ts` |
| Hook | `use<Feature>.ts` | `useReceiptForm.ts` |

### Anti-patterns to Avoid

- `fetch()` in a component → move to `api/` repository
- `parseFloat()` or formatting logic inline in JSX → move to domain service
- Hardcoded `YEARS = [2026, 2025, 2024]` → use `getYearOptions()` generator
- Business logic in a hook → extract to domain service, hook only orchestrates
- Mapping API response fields in a component → use a mapper
