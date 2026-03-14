---
name: astro-react
description: This skill should be used when integrating React components in Astro, using client directives, or implementing interactive islands. Covers the Islands Architecture pattern.
version: "1.0"
---

# Astro + React Integration

Patterns for using React components in Astro projects (Islands Architecture).

## Setup

```bash
npx astro add react
```

**astro.config.mjs**:
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
});
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

## Basic React Component

```tsx
// src/components/Counter.tsx
import { useState } from 'react';

interface Props {
  initialCount?: number;
  label: string;
}

export default function Counter({ initialCount = 0, label }: Props) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="flex items-center gap-4">
      <span>{label}: {count}</span>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Increment
      </button>
    </div>
  );
}
```

## Client Directives

### `client:load` - Hydrate immediately

```astro
---
import Counter from '../components/Counter.tsx';
---

<!-- Hydrates as soon as the page loads -->
<Counter client:load initialCount={5} label="Visits" />
```

**Use for:** Above-the-fold interactive elements, critical UI.

### `client:idle` - Hydrate when browser is idle

```astro
<!-- Hydrates when browser's requestIdleCallback fires -->
<NewsletterForm client:idle />
```

**Use for:** Lower-priority interactive elements.

### `client:visible` - Hydrate when visible

```astro
<!-- Hydrates when element enters viewport -->
<Chart client:visible data={chartData} />
```

**Use for:** Below-the-fold content, heavy components.

### `client:media` - Hydrate on media query

```astro
<!-- Only hydrates on mobile -->
<MobileMenu client:media="(max-width: 768px)" />
```

**Use for:** Responsive-only interactions.

### `client:only="react"` - Client-side only (no SSR)

```astro
<!-- Never rendered on server, only in browser -->
<MapComponent client:only="react" coordinates={coords} />
```

**Use for:** Components using browser-only APIs (window, localStorage, etc.)

## Using in Astro Pages

```astro
---
// src/pages/dashboard.astro
import Layout from '../layouts/Layout.astro';
import StaticHeader from '../components/Header.astro';
import Counter from '../components/Counter.tsx';
import Chart from '../components/Chart.tsx';
---

<Layout title="Dashboard">
  <!-- Static Astro component (no JS) -->
  <StaticHeader />

  <!-- React islands with different hydration -->
  <Counter client:load label="Active users" />

  <section class="mt-8">
    <Chart client:visible data={salesData} />
  </section>
</Layout>
```

## Passing Props

### Simple Props

```astro
<UserCard
  client:load
  name="John"
  age={30}
  isAdmin={true}
/>
```

### Complex Props (Objects/Arrays)

```astro
---
const user = {
  name: 'John',
  roles: ['admin', 'editor'],
  settings: { theme: 'dark' }
};
---

<UserProfile client:load user={user} />
```

### Children / Slots

```astro
<!-- Astro children become React children -->
<Modal client:load title="Confirm">
  <p>Are you sure?</p>
</Modal>
```

```tsx
// Modal.tsx
interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Modal({ title, children }: Props) {
  return (
    <div className="modal">
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
```

## MDX Integration

React components can be used directly in MDX:

```mdx
---
title: "Interactive Post"
---

import Chart from '../../components/Chart.tsx';

# Sales Report

<Chart client:visible data={[10, 20, 30]} />

Regular markdown continues...
```

## Sharing State Between Islands

Use nano stores or signals for cross-island state:

```bash
npm install nanostores @nanostores/react
```

```typescript
// src/stores/cart.ts
import { atom } from 'nanostores';

export const cartItems = atom<string[]>([]);

export function addToCart(item: string) {
  cartItems.set([...cartItems.get(), item]);
}
```

```tsx
// CartButton.tsx
import { useStore } from '@nanostores/react';
import { cartItems, addToCart } from '../stores/cart';

export default function CartButton({ productId }: { productId: string }) {
  const items = useStore(cartItems);

  return (
    <button onClick={() => addToCart(productId)}>
      Add to Cart ({items.length})
    </button>
  );
}
```

## Quick Reference

| Directive | When Hydrates | Use Case |
|-----------|---------------|----------|
| `client:load` | Page load | Critical interactive UI |
| `client:idle` | Browser idle | Non-critical UI |
| `client:visible` | In viewport | Below-fold, heavy components |
| `client:media="..."` | Media match | Responsive interactions |
| `client:only="react"` | Never SSR | Browser-only APIs |

### Performance Tips

- Default to `client:visible` for most components
- Use `client:load` sparingly (increases initial JS)
- Prefer Astro components for static content
- Use `client:only` for components with browser-only dependencies
