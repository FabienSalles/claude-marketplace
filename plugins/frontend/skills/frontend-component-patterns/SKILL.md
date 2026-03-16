---
name: frontend-component-patterns
description: "ACTIVATE when creating or refactoring React components, splitting large components, extracting hooks, or deciding Container vs Presentation. ACTIVATE for 'component split', 'Container/Presentation', 'extract hook', 'god component', 'prop drilling'. Covers: Container vs Presentation criteria, when to extract custom hooks (3+ related states), when to split markup (150+ lines), when to move logic to domain service, form section props convention, spotlight/opacity pattern. DO NOT use for: projects not using Container/Presentation (ask first), general React hooks API."
version: "1.1"
---

# Frontend Component Patterns

Apply only on projects that already follow Container/Presentation patterns. If the project does not use these patterns, ask the user before refactoring.

## Patterns

### Container vs Presentation

**Container components:**
- Use hooks and services for data/state management
- Contain minimal JSX (routing, conditional rendering, layout composition)
- Handle side-effects (API calls via hooks, navigation)
- Example: `ReceiptFormIsland` — uses `useReceiptForm()`, renders `DocumentAsForm` or success screen

**Presentation components:**
- Receive ALL data via props (no hooks, no direct service calls)
- Pure rendering: props → JSX
- Emit events via callback props (`onChange`, `onSubmit`, `onFieldFocus`)
- Example: `BailleurSection` — receives `landlordName`, `errors`, emits `onChange`

### Extraction Criteria

#### When to Extract a Custom Hook

Extract when **3 or more related state variables** are managed together:
- `useState` + `useState` + `useState` for related concerns → `useFeatureName()`
- State + effect + handler that always go together → hook

Do NOT extract a hook for:
- A single `useState`
- State that is only used in one place with no logic

#### When to Split Markup

Split a component when:
- JSX exceeds **150 lines**
- Sections have **independent behavior** (different event handlers, different state dependencies)
- A section is **reusable** across pages

Each extracted section should be **30-60 lines** of JSX.

#### When to Move Logic to a Domain Service

Move to `domain/<concern>.service.ts` when:
- `parseFloat()`, arithmetic, or formatting appears inline in JSX
- Conditional logic determines rendering but is based on pure data transformation
- The same calculation appears in multiple places
- Logic can be described without mentioning React, DOM, or UI concepts

### Component Props Conventions

#### Common Props Pattern for Form Sections

```typescript
interface SectionProps {
  // Section-specific data
  fieldName: string;
  // ...

  // Error display
  errors: Partial<Record<string, string>>;

  // Spotlight/focus system
  isActive: boolean;

  // Event callbacks
  onChange: (field: string, value: string | boolean) => void;
  onFieldFocus: (field: string) => void;
  onFieldBlur: (field: string) => void;
}
```

#### Opacity/Spotlight Pattern

Use a declarative mapping (in domain service) instead of inline prefix matching:
```typescript
// Domain service — pure mapping
const SECTION_FIELDS: Record<SectionKey, string[]> = {
  bailleur: ['landlordName', 'landlordEmail'],
  // ...
};

function isSectionActive(currentField: string, section: SectionKey): boolean {
  if (!currentField) return true;
  return SECTION_FIELDS[section].includes(currentField);
}
```

### Anti-patterns to Avoid

- **God component**: 300+ lines mixing data fetching, state management, business logic, and rendering → split into Container + Presentation + Hook + Service
- **Prop drilling through 3+ levels**: if props pass through a component unchanged, consider co-locating the hook closer to where data is used
- **Inline calculations in JSX**: `{(parseFloat(a) + parseFloat(b)).toFixed(2)}` → extract to domain service
- **Conditional rendering spaghetti**: nested ternaries for section visibility → extract to a declarative mapping
