# Home Temporada Card Link + Cart Flight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the home page's "Selección de Temporada" section, make each product card navigate to the product detail page on click, and make the "Agregar" button trigger the existing flying-circle-to-cart animation.

**Architecture:** Single-file change to `app/(public)/HomeClient.tsx`. Wrap the local `ProductCard`'s root `motion.div` in a `next/link` `Link` to `/producto/[slug]`, convert the variant-products "Ver opciones" pill from a nested `Link` to a plain `span` (avoids invalid nested `<a>`), and wire the existing `useAddToCartFlight` hook into `handleAdd` for simple (non-variant) products.

**Tech Stack:** Next.js App Router, React, framer-motion, existing `lib/hooks/useAddToCartFlight.ts` + `lib/stores/cartFlight.ts` + `components/carrito/CartFlightLayer.tsx` (already built and mounted in `app/(public)/layout.tsx` — not modified by this plan).

## Global Constraints

- No changes outside `app/(public)/HomeClient.tsx`.
- Do not add stock-check API calls, favorites, or an image carousel to this card — out of scope (per spec `docs/superpowers/specs/2026-07-16-home-temporada-card-link-and-flight-design.md`).
- No nested `<a>` tags (Next.js `Link` renders an `<a>`; nesting causes React DOM validation warnings/hydration issues).
- `event.currentTarget` must be captured into a local variable before any `await`, because React nulls it out after the handler yields.

---

### Task 1: Wrap card in Link and wire cart-flight animation

**Files:**
- Modify: `app/(public)/HomeClient.tsx:1-14` (imports)
- Modify: `app/(public)/HomeClient.tsx:31-228` (`ProductCard` function)

**Interfaces:**
- Consumes: `useAddToCartFlight` from `@/lib/hooks/useAddToCartFlight` — hook returning `launchFlight(args: { sourceEl: HTMLElement | null; quantity?: number }) => Promise<void>`. Already implemented, no changes needed.
- Produces: no new exports — `ProductCard` keeps its existing `{ product, index }` props signature.

- [ ] **Step 1: Add the `useAddToCartFlight` import**

In `app/(public)/HomeClient.tsx`, add the import alongside the existing hook imports:

```tsx
import { useCartStore } from '@/lib/stores/cart'
import { useAddToCartFlight } from '@/lib/hooks/useAddToCartFlight'
import { useStoreCheckout } from '@/components/providers/StoreCheckoutProvider'
```

- [ ] **Step 2: Rewrite `handleAdd` to capture the button and launch the flight**

Replace the current `handleAdd` (lines ~32-47) with:

```tsx
function ProductCard({ product, index }: { product: Product; index: number }) {
  const addItem = useCartStore((s) => s.addItem)
  const launchFlight = useAddToCartFlight()
  const [added, setAdded] = useState(false)

  const isOutOfStock = product.stock_status === 'out_of_stock'

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOutOfStock) return
    const sourceButton = e.currentTarget
    addItem(product)
    setAdded(true)
    launchFlight({ sourceEl: sourceButton, quantity: 1 })
    toast.success(`${product.name} agregado al carrito`, {
      icon: '🍜',
      description: '¡Buen provecho!',
      duration: 2000,
    })
    setTimeout(() => setAdded(false), 1400)
  }
```

  Note: `handleAdd` no longer needs to be `async` — `launchFlight` fires the
  animation and resolves on its own timer; the button click doesn't need to
  wait for it. Passing `e.currentTarget` synchronously (no `await` before it)
  keeps the reference valid.

- [ ] **Step 3: Wrap the card root in a `Link`, and convert "Ver opciones" to a `span`**

The `ProductCard` currently returns a bare `motion.div` (line ~53) and, for
variant products, renders a nested `<Link href={.../producto/${product.slug}}>`
for "Ver opciones" (lines ~176-184). Change the return so the whole card is
one outer `Link`, and the inner one becomes a non-link pill:

```tsx
  return (
    <Link href={`/producto/${product.slug}`}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        whileHover={isOutOfStock ? {} : { y: -3, transition: { type: 'spring', stiffness: 300, damping: 28 } }}
        className={`card-product group overflow-hidden flex flex-col ${
          isOutOfStock ? 'ring-1 ring-amber-200/80' : ''
        }`}
      >
```

  (body unchanged down to the price/CTA block)

  Replace the variant-product CTA block:

  ```tsx
  ) : product.has_variants ? (
    <Link
      href={`/producto/${product.slug}`}
      className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/20"
      onClick={(e) => e.stopPropagation()}
    >
      Ver opciones
      <ChevronRight className="w-3 h-3" />
    </Link>
  ) : (
  ```

  with:

  ```tsx
  ) : product.has_variants ? (
    <span className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/20">
      Ver opciones
      <ChevronRight className="w-3 h-3" />
    </span>
  ) : (
  ```

  Close the outer `Link` at the very end of the component, replacing the
  final `</motion.div>\n  )` with:

  ```tsx
      </motion.div>
    </Link>
  )
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `HomeClient.tsx`.

- [ ] **Step 5: Manual verification (no component test harness exists for this file — see spec's Testing section)**

Run: `npm run dev`, open the home page in a browser:
- Click a non-interactive part of a "Temporada" card → navigates to `/producto/[slug]`.
- Click "Agregar" on a simple product → adds to cart, shows the flying circle
  from the button to the cart icon (check both mobile-width and desktop-width
  viewports, since the target differs by `data-cart-fly-target`), and does
  **not** navigate away from the home page.
- Click "Ver opciones" on a variant product → navigates to `/producto/[slug]`
  (unchanged behavior).
- No React warning about nested `<a>` tags in the browser console.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/HomeClient.tsx"
git commit -m "feat: make temporada product cards clickable and animate add-to-cart"
```
