# Auditoría de rendimiento — nurei (Next.js 16 / App Router)

Fecha: 2026-07-18
Alcance: `app/(public)/*` (tienda pública: home, menú, producto, checkout, pedido, perfil, favoritos, guías, legal, login/registro, nosotros). Solo auditoría — no se modificó código.

Nota metodológica: no fue posible ejecutar `next build` limpio durante la auditoría porque ya había un proceso `next-server` activo en la máquina ("Another next build process is already running"), y no se detuvo ese proceso por no interferir con un servidor potencialmente en uso. El análisis de bundle se basa en revisión estática de imports, `next.config.ts`, y el árbol `app/`. Se recomienda correr `next experimental-analyze --output` en un entorno limpio para confirmar tamaños exactos por ruta.

---

## Resumen ejecutivo (ordenado por impacto)

1. **Alto / LCP** — La página de inicio (`/`, la de más tráfico) no usa `next/image`: renderiza imágenes de producto con `<motion.img>` crudo, sin optimización, sin `sizes`, sin lazy loading explícito, todas cargando eager.
2. **Alto / LCP** — `producto/[slug]/page.tsx` hace 3 queries a Supabase con 2 waterfalls secuenciales (variantes y relacionados no van en `Promise.all`) antes de enviar HTML.
3. **Medio / INP-TTI** — El script de Microsoft Clarity se carga con `strategy="beforeInteractive"` en el `<head>` global — se ejecuta antes de la hidratación de React en cada página pública, incluyendo checkout.
4. **Medio / LCP** — `nosotros/page.tsx` es un Server Component candidato pero está marcado `'use client'` completo solo por animaciones de entrada con `framer-motion`; envía JS innecesario y pierde streaming SSR.
5. **Bajo-Medio / LCP** — `images.formats` en `next.config.ts` solo incluye `webp`, no `avif` (compresión ~20-30% mejor disponible sin costo de código).

Puntos fuertes ya implementados correctamente (para no duplicar esfuerzo):
- `page.tsx` (home) y `menu/page.tsx` evitan `cookies()`/`headers()` explícitamente (comentado en código) y usan `createServiceClient()` + `revalidate = 300` → ISR real, sin el problema de "cookies rompen ISR" que sí ocurrió en otro proyecto del usuario.
- `guias/page.tsx` y `guias/[slug]/page.tsx` son 100% estáticos con `revalidate = 604800` y `generateStaticParams` — óptimo para SEO/LCP.
- `producto/[slug]/ProductDetailClient.tsx` y `components/productos/ProductCard.tsx` (usado en `/menu`) sí usan `next/image` vía el wrapper `MotionImage` (`components/ui/motion-image.tsx = motion.create(Image)`), con `sizes` y `priority` correctos en la imagen principal.
- GA4 y Meta Pixel (`components/tracking/TrackingScripts.tsx`) usan `next/script` con `strategy="afterInteractive"` correctamente, y solo se inyectan tras consentimiento (`useConsent`).
- Checkout **no** carga `@stripe/stripe-js` — redirige a Stripe Checkout hosteado por API (`/api/payment/create-checkout`), así que el bundle de checkout no paga el costo de Stripe.js. `lib/stripe/client.ts` (`getStripe()`) existe pero no tiene ningún importador real en el código de producto — es código muerto, no un problema de bundle.
- `recharts`, `exceljs`, `@tiptap/*`, `papaparse` están confinados a `app/admin/*`, `app/affiliate/*` y route handlers de API (server-only); no hay imports cruzados hacia la tienda pública. El code-splitting automático por ruta del App Router ya resuelve esto sin necesidad de `next/dynamic`.
- Tracker de Web Vitals propio (`components/performance/WebVitalsTracker.tsx`) está bien construido: `import('web-vitals')` dinámico, batching con `sendBeacon`, debounce de 10s, sampling (10% good / 50% needs-improvement / 100% poor) y flush en `visibilitychange`/`pagehide`. No requiere cambios.
- Fuentes: `next/font/google` con `display: 'optional'` y `fallback` explícito — cero CLS por fuentes, decisión correcta y ya documentada en comentarios del propio código.
- `next.config.ts` ya tiene `optimizePackageImports` para `lucide-react`, `recharts`, `framer-motion`, `@tiptap/*`, `date-fns`; CSP y security headers configurados; `productionBrowserSourceMaps: false`; `X-Robots-Tag: noindex` en rutas de cuenta (`checkout`, `favoritos`, `login`, `registro`, `perfil`, `pedido`, `affiliates`).

---

## 1. Estrategia de renderizado por ruta

| Ruta | Estrategia | Evaluación |
|---|---|---|
| `/` (home) | Server Component + `revalidate = 300` (ISR), `createServiceClient()` sin cookies | Correcto |
| `/menu` | Server Component + `revalidate = 300` (ISR) | Correcto |
| `/producto/[slug]` | Server Component + `revalidate = 300`, `generateStaticParams` vacío (ISR on-demand) | Correcto en estrategia, pero con waterfall de datos (ver §6) |
| `/guias`, `/guias/[slug]` | Server Component + `revalidate = 604800`, `generateStaticParams` completo, `dynamicParams = false` | Óptimo — 100% estático |
| `/legal/*` | Server Component, sin `revalidate` explícito (estático por defecto al no usar APIs dinámicas) | Correcto |
| `/nosotros` | **`'use client'` completo**, sin data fetching | Innecesario — ver hallazgo #4 |
| `/checkout` | `'use client'` completo, 2094 líneas | Esperado (formulario altamente interactivo), pero monolítico — ver §7 |
| `/pedido/[id]` | `'use client'` completo, fetch de la orden ocurre en el cliente vía `useEffect` | Página de confirmación post-compra sin datos server-rendered — ver hallazgo abajo |
| `/perfil`, `/favoritos`, `/login`, `/registro` | `'use client'` completo | Correcto — son vistas personalizadas/auth, ya con `noindex` vía headers |

**No se encontró uso de `cookies()` ni `headers()` en ningún `page.tsx` bajo `app/(public)`** (verificado con grep recursivo). El antecedente de "cookies rompen ISR" de otro proyecto del usuario **no se repite aquí**; el código incluso tiene comentarios explícitos dejando constancia de la decisión (`// Service client (no cookies()) keeps this page ISR-cacheable`).

### Hallazgo: `/pedido/[id]` sin datos server-side
`app/(public)/pedido/[id]/page.tsx` es client-only y obtiene la orden completa (incluyendo los eventos de tracking de compra GA4/Meta) enteramente vía `fetch` en `useEffect` después de montar. Esto significa: HTML vacío → JS baja → hidrata → fetch → render. Para la página de confirmación de compra (crítica para disparar el evento `purchase` de GA4/Meta con datos correctos y rápido), esto añade una segunda vuelta de red antes de mostrar contenido útil.
- **Impacto**: Medio / LCP y tiempo-a-contenido-útil en la página de post-compra.
- **Corrección**: convertir a Server Component que haga `getOrder(id)` en el servidor (usando el mismo patrón de `createServiceClient()` que usan home/menu, pero aquí sí se necesita verificar identidad del comprador — puede usarse `cookies()` aceptando que esta ruta específica sea dinámica, ya que no es candidata a ISR de todos modos) y pasar `initialOrder` al client component para hidratar, siguiendo el patrón "Option 1: Pass from Server Component" ya usado en `page.tsx` → `HomeClient`.

---

## 2. Uso de `'use client'`

10 de 20 archivos `.tsx` en `app/(public)` son `'use client'`. La mayoría se justifica por interactividad real (carrito, forms, auth). Un caso no se justifica:

### Hallazgo: `app/(public)/nosotros/page.tsx` — Client Component sin necesidad
```tsx
'use client'
import { motion } from 'framer-motion'
...
export default function NosotrosPage() {
  return (
    <PageTransition>
      {/* Hero Section */}
      <section>...</section>
```
Es contenido 100% estático (texto de marca, stats fijos: "+500 productos", "+2,000 clientes") sin ningún `useState`/`useEffect`/manejo de eventos de usuario — solo animaciones de entrada (`whileHover`, `initial`/`animate`) de `framer-motion`. Al marcar todo el árbol como cliente:
- Se envía el árbol completo de la página + `framer-motion` (que ya está en `optimizePackageImports`, pero aun así no es cero-JS) al navegador para una página sin ninguna interacción real más allá de scroll-reveal.
- Se pierde la posibilidad de streaming SSR / Server Component puro.

- **Impacto**: Bajo-Medio / LCP y peso de JS en una ruta secundaria (pero indexada, con tráfico orgánico de SEO tipo "nosotros"/"about").
- **Corrección**: mover solo los elementos animados a un client component pequeño (p. ej. `<AnimatedStat>`), dejar `NosotrosPage` como Server Component, o sustituir las animaciones de entrada por `@keyframes`/`animation` CSS con `animation-timeline` o Intersection Observer nativo — no requiere JS de framer-motion para un fade-in simple.

`login/page.tsx` y `registro/page.tsx` están correctamente marcados client (requieren `useRouter`, `useSearchParams`, estado de formulario) — no se recomienda cambio.

---

## 3. Bundle size

No se pudo generar un build de producción limpio (proceso `next-server` ya corriendo, ver nota metodológica). Análisis estático:

- **`recharts`, `exceljs`, `@tiptap/*`, `papaparse`**: confirmados exclusivos de `app/admin/*`, `app/affiliate/*` y `app/api/admin/*` (route handlers, server-only). Cero imports cruzados hacia `app/(public)`. El App Router ya aísla estos bundles por segmento de ruta sin necesidad de `next/dynamic`. **No se requiere acción.**
- **`framer-motion`**: usado extensivamente en la tienda pública (`HomeClient`, `ProductCard`, `ProductDetailClient`, `MenuClient`, `checkout/page.tsx`, `nosotros`, `perfil`, `login`, `registro`, `pedido/[id]`) — es una dependencia transversal real del "look and feel" de la tienda, no hay forma de aislarla sin rediseño. Ya está en `optimizePackageImports`, lo cual ayuda con tree-shaking de submódulos no usados.
- **No existe ni un solo `next/dynamic()` o `React.lazy()` en todo el repo** (`app`, `components`, `lib`). Para bundles grandes dentro de una misma ruta (p. ej. modales de `checkout/page.tsx`: `Dialog` de confirmación, `SearchableSelect` con opciones geográficas), esto es una oportunidad no explotada — ver §7.
- **`getStripe()`/`@stripe/stripe-js`** (`lib/stripe/client.ts`): sin importadores reales en código de producto (solo definido, nunca llamado desde un client component). Es código muerto — no infla el bundle porque nada lo importa, pero vale la pena limpiarlo o confirmar que no hay un flujo de pago con Stripe Elements planeado que dependa de él.

**Recomendación de verificación**: correr en un entorno donde no haya otro proceso Next activo:
```bash
next build && next experimental-analyze --output
```
y revisar especialmente el tamaño de First Load JS de `/checkout` (2094 líneas en un solo archivo client) y de `/` (home).

---

## 4. Imágenes

### Hallazgo crítico: Home (`HomeClient.tsx`) no usa `next/image`
```tsx
// app/(public)/HomeClient.tsx, dentro del ProductCard local del home
<motion.img
  src={product.images[product.primary_image_index ?? 0] || product.images[0]}
  alt={product.name}
  className="... group-hover:scale-110"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.4 }}
/>
```
Este es un `<img>` nativo envuelto por `motion.img` de framer-motion directamente — **no** el helper `MotionImage` (`components/ui/motion-image.tsx`, que sí envuelve `next/image` y ya existe en el propio repo, usado correctamente en `components/productos/ProductCard.tsx` para `/menu`). Consecuencias en la home (ruta de mayor tráfico):
- Sin optimización automática de Vercel Image (sin conversión a WebP/AVIF, sin resize a las dimensiones reales de display) — las imágenes se sirven tal cual están en Supabase Storage.
- Sin `sizes`/`fill` — el navegador no puede elegir una variante adecuada al viewport.
- Sin `width`/`height` ni `loading="lazy"` explícito — todas las tarjetas de producto de la grilla (potencialmente 12-20+ en la carga inicial) cargan como `eager` por defecto de `<img>`, compitiendo por ancho de banda con la imagen LCP real en el hero/primeras tarjetas.
- Nótese que el mismo archivo sí importa correctamente patrones consistentes en otras partes de la tienda (`ProductDetailClient.tsx`, `ProductCard.tsx` de `/menu`) — es una inconsistencia puntual en `HomeClient.tsx`, no un problema sistémico.

- **Impacto**: **Alto / LCP** — la home es probablemente la landing de mayor entrada orgánica y de ads; si el elemento LCP es una imagen de producto del grid, hoy compite sin optimizar contra N imágenes hermanas cargando eager, y pesa más de lo necesario por no tener conversión automática a formatos modernos.
- **Corrección**: reemplazar `<motion.img>` por el mismo patrón que `components/productos/ProductCard.tsx` ya usa:
```tsx
import { MotionImage } from '@/components/ui/motion-image'

<div className="relative aspect-square ...">
  <MotionImage
    src={product.images[product.primary_image_index ?? 0] || product.images[0]}
    alt={product.name}
    fill
    sizes="(max-width: 640px) 50vw, 25vw"
    priority={index < 4} // solo las primeras tarjetas above-the-fold
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
    className="object-cover group-hover:scale-110"
  />
</div>
```
Nota: al usar `fill`, el contenedor padre ya tiene `aspect-square` (confirmado en el código), así que no se introduce CLS.

### Hallazgo menor: falta AVIF en `next.config.ts`
```ts
images: {
  remotePatterns: [...],
  formats: ['image/webp'],
}
```
Next/Vercel Image Optimization soporta AVIF, que típicamente reduce 20-30% más peso que WebP para fotografía de producto, al mismo costo de implementación (config de una línea).
- **Impacto**: Bajo-Medio / LCP (ahorro de payload en primera carga de imágenes).
- **Corrección**:
```ts
images: {
  remotePatterns: [...],
  formats: ['image/avif', 'image/webp'],
}
```
(orden importa: Next intenta el primero que el navegador soporte vía `Accept` header).

### Imágenes de miniatura con `<img>` nativo (aceptable)
En `ProductDetailClient.tsx` (líneas ~682, 740, 1018) y `ProductCard.tsx` (líneas ~421-466) hay `<img loading="lazy" decoding="async">` nativos para miniaturas pequeñas de variantes/thumbnails (28-56px). Esto es una decisión razonable — usar `next/image` para imágenes tan pequeñas tiene overhead de optimización que no compensa; ya llevan `loading="lazy"` y `decoding="async"` correctamente. **No se recomienda cambio aquí.**

### `sharp`
Usado únicamente en `app/api/admin/media/from-url/route.ts` (server-side, procesamiento de subida de imágenes en el admin). Correctamente aislado del runtime de cliente; no aplica a Core Web Vitals de la tienda pública directamente, solo a la calidad de las imágenes que terminan sirviéndose.

---

## 5. Fuentes

`app/layout.tsx`:
```tsx
const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'optional',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
  fallback: [...],
})
```
- `next/font/google` autoalojada (sin request a Google en runtime) — correcto.
- `display: 'optional'` es la estrategia más agresiva contra CLS (usa fallback permanentemente si la fuente no está lista a tiempo) — decisión correcta y documentada en comentario del propio código, coherente con el objetivo de CLS < 0.1.
- `JetBrains_Mono` con `preload: false` — correcto, es una fuente secundaria (probablemente para precios/códigos) que no debe competir por prioridad de red con la fuente principal.
- Un solo `subsets: ['latin']` en ambas — apropiado para contenido en español (México), sin cargar juegos de caracteres innecesarios.

**No se encontraron manual `<link>` a Google Fonts ni `@import` de fuentes en CSS.** Sin hallazgos aquí.

---

## 6. Data fetching (Supabase) — N+1 y waterfalls

### Hallazgo: waterfall secuencial en `producto/[slug]/page.tsx`
```tsx
export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let product: Product
  product = await getPublicProductBySlug(slug)          // 1ª query

  let variants: ProductVariant[] = product.variants ?? []
  if (product.has_variants) {
    variants = await listPublicVariants(product.id)      // 2ª query — espera a la 1ª
  }

  let related: Product[] = []
  const categoryProducts = await listProducts({ category: product.category, status: 'active' }) // 3ª query — espera a la 2ª
  related = categoryProducts.filter((p) => p.id !== product.id).slice(0, 4)

  return (<ProductDetailClient ... />)
}
```
El fetch de `variants` y el de `related` **no dependen entre sí** (ambos solo dependen de `product`, ya resuelto) pero se ejecutan en secuencia con dos `await` separados en vez de `Promise.all`. Cada roundtrip a Supabase (aunque sea rápido, tipicamente 20-80ms) se suma en cadena en vez de en paralelo. Como esta página tiene `revalidate = 300` (ISR), el costo solo se paga en el primer request tras cada expiración de caché, pero ese primer visitante (que puede ser un crawler de Google o un clic desde ads) sí experimenta el TTFB completo de 3 queries secuenciales.

- **Impacto**: Medio / LCP y TTFB en cache-miss de la página de producto (la página más importante para conversión después de checkout).
- **Corrección**:
```tsx
const product = await getPublicProductBySlug(slug)

const [variants, related] = await Promise.all([
  product.has_variants
    ? listPublicVariants(product.id).catch(() => { variantsError = true; return product.variants ?? [] })
    : Promise.resolve(product.variants ?? []),
  listProducts({ category: product.category, status: 'active' })
    .then((cats) => cats.filter((p) => p.id !== product.id).slice(0, 4))
    .catch(() => []),
])
```

### Ausencia total de streaming SSR con `Suspense` en catálogo
Se buscó `Suspense` en todo `app/(public)` y solo aparece en 3 lugares, los tres para satisfacer el requisito de Next de envolver `useSearchParams()` (`layout.tsx` para `ReferralTracker`, `perfil/page.tsx`, `login/page.tsx`) — **ninguno se usa para streaming de contenido lento**.

En `producto/[slug]/page.tsx`, "productos relacionados" no es crítico para el LCP (el LCP es la imagen/título/precio del producto principal) pero hoy bloquea el envío del HTML junto con todo lo demás.
- **Impacto**: Medio / LCP — cada query adicional en la cascada retrasa el primer byte útil de HTML.
- **Corrección**: separar "relacionados" en su propio Server Component async y envolverlo en `<Suspense>` con skeleton, para que el producto principal se streamee primero:
```tsx
<ProductDetailClient initialProduct={product} initialVariants={variants} ... />
<Suspense fallback={<RelatedProductsSkeleton />}>
  <RelatedProducts category={product.category} excludeId={product.id} />
</Suspense>
```
(Nota: esto requiere que `RelatedProducts` sea un Server Component separado que se renderice fuera de `ProductDetailClient`, ya que este último es client — habría que decidir si vale la pena el refactor dado que hoy `related` se pasa como prop a un client component único.)

### No se encontraron N+1 clásicos (queries dentro de loops)
`listProducts()` usa un solo `select('*, product_variants(...)')` con embed de Supabase (join implícito), evitando N+1 al listar productos con variantes — patrón correcto. `getSettings()` y `listCategories()` se llaman en `Promise.all` junto con `listProducts()` en `page.tsx` (home) y `menu/page.tsx` — correctamente paralelizado ahí. El waterfall señalado arriba es específico de la página de producto individual.

---

## 7. Checkout

- **No carga Stripe.js** — usa redirect a Stripe Checkout hosteado (`/api/payment/create-checkout` devuelve una URL y el cliente hace `window.location`), confirmado por ausencia de imports de `@stripe/stripe-js` en `checkout/page.tsx`. Esto es lo ideal para performance: cero JS de terceros de pago en el bundle de checkout.
- **Archivo monolítico**: `app/(public)/checkout/page.tsx` tiene 2094 líneas, un solo `'use client'` en el tope, 18 `useEffect` independientes, y renderiza inline un `Dialog` de shadcn/ui (confirmación), `SearchableSelect` (estado/ciudad), `SnackWaitAnimation`, `GoogleAuthButton`. Nada de esto usa `next/dynamic`.
- **Cascada esperada de ubicación** (país → estados → ciudades vía `/api/location/options`) es secuencial por diseño (cada nivel depende del anterior) — no es un anti-patrón corregible con `Promise.all`, es UX normal de formularios geográficos en cascada.
- **Impacto**: Bajo-Medio / INP y tamaño de bundle de la ruta más crítica para conversión — un archivo de este tamaño compila a un chunk grande que debe parsearse/ejecutarse/hidratarse completo aunque el usuario solo vea el primer paso del formulario.
- **Corrección sugerida** (sin necesidad de fragmentar el estado del formulario, que es razonablemente compartido):
  - Extraer el `Dialog` de confirmación de orden y el `SnackWaitAnimation` (probablemente solo visible tras submit) a `next/dynamic(() => import('...'), { ssr: false })`, ya que no se necesitan para el first paint del formulario.
  - Extraer `SearchableSelect` con datos geográficos de forma similar si su bundle de opciones es significativo.

---

## 8. `next.config.ts` — revisión de configuración

```ts
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [...],
    formats: ['image/webp'],       // falta 'image/avif' — ver §4
  },
  async headers() { ... },          // CSP, HSTS, noindex por ruta — bien configurado
  experimental: {
    workerThreads: false,
    webpackMemoryOptimizations: true,
    optimizePackageImports: [ ... ],  // bien configurado
  },
  productionBrowserSourceMaps: false, // correcto para prod (evita exponer mapas y reduce peso de deploy)
  compiler: { removeConsole: process.env.NODE_ENV === 'production' }, // correcto
}
```
- `compress` (gzip/brotli) no está declarado explícitamente, pero Vercel comprime automáticamente en el edge independientemente de esta opción de Next (que solo aplica a `next start` standalone) — no requiere cambio en despliegue Vercel.
- No hay `experimental.ppr` (Partial Prerendering) habilitado. Dado que la home y `/menu` ya logran ISR limpio evitando `cookies()`, PPR no aportaría una ganancia dramática ahí, pero **sí sería la solución arquitectónicamente correcta para `/producto/[slug]`** (shell estático del producto + streaming de "relacionados" dinámico) en vez de fragmentar manualmente con `Suspense` — vale la pena evaluarlo si el proyecto se mantiene en Next 16.x con soporte estable de PPR.
- CSP: `script-src` incluye `'unsafe-inline' 'unsafe-eval'` (necesario para hidratación de Next, comentado en el código) — no es un hallazgo de performance sino de seguridad, fuera de alcance de este reporte.

---

## 9. Terceros (analytics, pixels, Clarity)

| Script | Estrategia actual | Evaluación |
|---|---|---|
| Vercel Analytics (`@vercel/analytics/react`) | Componente `<Analytics />` de Vercel, se auto-gestiona | Correcto, sin acción |
| GA4 (`gtag.js`) | `next/script` `strategy="afterInteractive"`, solo tras consentimiento | Correcto |
| Meta Pixel | `next/script` `strategy="afterInteractive"`, solo tras consentimiento | Correcto |
| **Microsoft Clarity** | `next/script` `strategy="beforeInteractive"` en `app/layout.tsx`, **sin gate de consentimiento** (se ejecuta siempre que `NEXT_PUBLIC_CLARITY_PROJECT_ID` esté seteado, a diferencia de GA4/Meta que sí esperan `consent === 'accepted'`) | **Hallazgo** |

### Hallazgo: Clarity con `strategy="beforeInteractive"`
```tsx
{clarityId ? (
  <Script id="clarity-init" strategy="beforeInteractive">
    {`(function(c,l,a,r,i,t,y){ ... })(window, document, "clarity", "script", "${clarityId}");`}
  </Script>
) : null}
```
`beforeInteractive` está documentado por Next.js para scripts que deben ejecutarse **antes** de que cualquier JS de la página se ejecute (polyfills críticos) — se inyecta en el HTML inicial y se ejecuta antes de la hidratación de React. Clarity es una herramienta de session recording, no un polyfill crítico; no hay razón funcional para bloquear la hidratación con él. Además, a diferencia de GA4/Meta (que están correctamente detrás de `useConsent()` en `TrackingScripts.tsx`), Clarity se inyecta en `layout.tsx` sin chequear consentimiento — esto también es relevante para cumplimiento de CSP/privacidad, pero el impacto de performance es lo que corresponde a este reporte.

- **Impacto**: Medio / INP y tiempo de hidratación — en **todas** las páginas públicas, incluyendo checkout, se ejecuta un script de terceros antes de que React hidrate, compitiendo por el main thread justo en la ventana crítica de interactividad.
- **Corrección**: cambiar a `strategy="afterInteractive"` (o moverlo dentro de `TrackingScripts.tsx` junto a GA4/Meta, respetando el mismo gate de consentimiento):
```tsx
<Script id="clarity-init" strategy="afterInteractive">
  {`...`}
</Script>
```

---

## 10. Suspense / streaming

Cubierto en detalle en §6. Resumen: el único uso de `Suspense` en la tienda pública es el mínimo requerido por Next para `useSearchParams()`; no se aprovecha para streaming de secciones lentas (productos relacionados en `/producto/[slug]`). Es la brecha más clara entre "lo que el App Router permite" y "lo que el código usa hoy".

---

## Tabla de hallazgos y prioridad de corrección

| # | Hallazgo | Archivo | CWV afectado | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| 1 | Imágenes de producto en home sin `next/image` | `app/(public)/HomeClient.tsx` | LCP | Alto | Bajo (reusar `MotionImage`) |
| 2 | Waterfall de 3 queries secuenciales en producto | `app/(public)/producto/[slug]/page.tsx` | LCP, TTFB | Medio-Alto | Bajo (`Promise.all`) |
| 3 | Clarity `beforeInteractive` sin gate de consentimiento | `app/layout.tsx` | INP | Medio | Bajo (cambiar strategy) |
| 4 | `nosotros/page.tsx` client completo sin necesidad | `app/(public)/nosotros/page.tsx` | LCP, JS payload | Bajo-Medio | Medio (extraer subcomponente) |
| 5 | Falta AVIF en `images.formats` | `next.config.ts` | LCP | Bajo-Medio | Trivial |
| 6 | `/pedido/[id]` sin server-render de datos | `app/(public)/pedido/[id]/page.tsx` | LCP / TTI post-compra | Medio | Medio |
| 7 | Sin `Suspense`/streaming para "relacionados" | `app/(public)/producto/[slug]/page.tsx` | LCP | Medio | Medio (requiere separar server/client) |
| 8 | Checkout monolítico sin `next/dynamic` para modal/wait-animation | `app/(public)/checkout/page.tsx` | INP, bundle size | Bajo-Medio | Medio |

---

## Verificación recomendada post-fix

1. Re-medir en Speed Insights / dashboard de Vercel tras cada cambio (no solo Lighthouse local).
2. `next build && next experimental-analyze --output` en entorno limpio (sin otro proceso Next corriendo) para confirmar tamaño real de First Load JS de `/` y `/checkout` antes/después.
3. Chrome DevTools → Performance, cargar `/` en 4G simulado, confirmar qué elemento es el LCP actual y medir su tiempo tras el fix de imágenes.
