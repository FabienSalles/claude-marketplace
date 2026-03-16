---
name: astro-react
description: "ACTIVATE when integrating React components in Astro, choosing client directives, or implementing interactive islands. ACTIVATE for 'client:load', 'client:visible', 'client:idle', 'client:only', 'React island', 'nanostores'. Covers: client directive selection (load/idle/visible/media/only), props passing, MDX integration, cross-island state sharing with nanostores. DO NOT use for: pure Astro components (see astro-basics), general React patterns."
version: "1.1"
---

# Astro + React Integration

Patterns for using React components in Astro projects (Islands Architecture).

## Setup

```bash
npx astro add react
```

## Component File Structure

```
src/
├── components/
│   ├── Button.astro      # Static Astro component
│   ├── Counter.tsx       # Interactive React component
│   ├── Chart.tsx         # Client-side only component
│   └── SearchBar.tsx     # Hydrated on visibility
```

## Client Directives

| Directive | When Hydrates | Use Case |
|-----------|---------------|----------|
| `client:load` | Page load | Critical interactive UI |
| `client:idle` | Browser idle | Non-critical UI |
| `client:visible` | In viewport | Below-fold, heavy components |
| `client:media="..."` | Media match | Responsive interactions |
| `client:only="react"` | Never SSR | Browser-only APIs |

### Usage

```astro
<Counter client:load initialCount={5} label="Visits" />
<Chart client:visible data={chartData} />
<MobileMenu client:media="(max-width: 768px)" />
<MapComponent client:only="react" coordinates={coords} />
```

> **When building React components, passing complex props, or using children/slots**, read `references/react-integration-examples.md` for complete component patterns.

> **When sharing state between islands with nanostores**, read `references/react-integration-examples.md` for the store setup and useStore pattern.

> **When using React components in MDX**, read `references/react-integration-examples.md` for MDX integration examples.

### Performance Tips

- Default to `client:visible` for most components
- Use `client:load` sparingly (increases initial JS)
- Prefer Astro components for static content
- Use `client:only` for components with browser-only dependencies
