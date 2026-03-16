# React Integration Examples

## Table of Contents
- [Basic React Component](#basic-react-component)
- [Using in Astro Pages](#using-in-astro-pages)
- [Passing Props](#passing-props)
- [MDX Integration](#mdx-integration)
- [Sharing State Between Islands](#sharing-state-between-islands)

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

Using nanostores for cross-island state:

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
