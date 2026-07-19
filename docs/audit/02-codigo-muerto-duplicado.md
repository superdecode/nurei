# Auditoría: código muerto, duplicado y limpieza — nurei

Fecha: 2026-07-18
Alcance: `app/`, `lib/`, `components/`, `types/` (~66,925 líneas). Esto es solo una auditoría — no se modificó ningún archivo de producto.

## Metodología

Herramientas ejecutadas vía `npx` (sin tocar `package.json`):
- `npx knip` (v6.27.0) — exports, archivos y dependencias sin usar.
- `npx depcheck` (v1.4.7) — dependencias declaradas vs. usadas.
- `npx ts-prune` — exports TS nunca importados.
- `npx eslint . --report-unused-disable-directives` — directivas `eslint-disable` inútiles.
- Búsquedas manuales con `grep` para confirmar cada hallazgo (import real, no solo coincidencia de nombre) antes de listarlo.

**Nota importante:** el árbol de trabajo contiene varios directorios `.claude/worktrees/agent-*` que son copias completas del mismo repo (otras sesiones de agentes en paralelo). Todos los resultados de `knip`/`ts-prune` que caían dentro de esos directorios fueron filtrados/excluidos del análisis para evitar contarlos por triplicado.

**Trabajo en curso detectado:** `git status` muestra cambios sin commitear en `lib/utils/constants.ts`, `types/index.ts` y archivos nuevos (`app/admin/reembolsos/`, `app/api/admin/refunds/`, `lib/supabase/queries/adminRefunds.ts`) — feature de reembolsos en desarrollo activo. Ningún hallazgo de este reporte toca esos archivos.

---

## 1. Dependencias no usadas

### 1.1 Confirmadas sin uso (SAFE — verificado con grep, cero imports reales)

| Paquete | Tipo | Evidencia |
|---|---|---|
| `@hookform/resolvers` | dependency | Cero `import ... from '@hookform/resolvers'` en todo el repo (solo aparece en `package.json`). |
| `react-hook-form` | dependency | Cero `import ... from 'react-hook-form'` en todo el repo. Los formularios del proyecto usan estado local + Zod, no react-hook-form. |
| `@tiptap/extension-link` | dependency | `components/admin/RichTextEditor.tsx` importa `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline` — pero nunca `@tiptap/extension-link` (usa `next/link` para navegación normal). |
| `date-fns` | dependency | Solo aparece dentro de `next.config.ts:81` en la lista `experimental.optimizePackageImports` (optimización preventiva para un paquete que nunca se importa). Cero `import ... from 'date-fns'` en el código. |
| `@types/dompurify` | dependency | El código usa `isomorphic-dompurify` (`app/(public)/producto/[slug]/ProductDetailClient.tsx:3`), que ya trae sus propios tipos (`node_modules/isomorphic-dompurify/package.json` → `"types": "./dist/index.d.ts"`). No hay ningún `import from 'dompurify'` directo que necesite `@types/dompurify`. |
| `@types/uuid` (devDependency) | devDependency | `uuid` v13 ya trae sus propios tipos (`node_modules/uuid/package.json` → `"types": "./dist/index.d.ts"`). El paquete de tipos es redundante. |

### 1.2 Dependencia que quedará huérfana al limpiar código muerto (ver sección 2)

| Paquete | Nota |
|---|---|
| `@stripe/stripe-js` | Solo se usa dentro de `lib/stripe/client.ts` (`getStripe()` con `loadStripe`), y ese archivo no tiene ningún importador en el repo (ver 2.1). Si se elimina el archivo, la dependencia queda sin uso. Antes de borrar, confirmar que no hay un flujo de Stripe Elements/Checkout client-side planeado a corto plazo (el checkout actual usa `stripe/server.ts` + redirect a Stripe Checkout, no Stripe.js en el cliente). |

### 1.3 Falsos positivos descartados (NO eliminar)

`depcheck` marcó estos como no usados, pero se confirmó uso real:

- **`tailwindcss`** — usado vía `@import "tailwindcss";` en `app/globals.css:1` y por `@tailwindcss/postcss` en `postcss.config.mjs`. `depcheck` no detecta imports CSS.
- **`@tailwindcss/postcss`** — usado en `postcss.config.mjs` (config de build, `depcheck` no lo escanea).
- **`tw-animate-css`** — usado vía `@import "tw-animate-css";` en `app/globals.css:2`.
- **`shadcn`** — usado vía `@import "shadcn/tailwind.css";` en `app/globals.css:3` (además de ser la CLI de scaffolding, `components.json`). Está en `dependencies` pero conceptualmente es más devtool; no es código muerto, es un tema de categorización menor.

### 1.4 Dependencia faltante (missing, no relacionada a código muerto)

- `dotenv` — usado en `scripts/seed-affiliates.ts` y `scripts/seed-categories.ts` pero no declarado en `package.json`. Posiblemente resuelto de forma transitiva por otra dependencia; si esos scripts se ejecutan de forma independiente (`npx tsx scripts/...`), conviene declararlo explícito como devDependency.

---

## 2. Exports / archivos muertos

### 2.1 Archivos completos sin ningún importador (confirmado con grep, no solo `knip`)

| Archivo | Líneas | Evidencia |
|---|---|---|
| `lib/data/mockOrders.ts` | ~90 | Cero referencias a `data/mockOrders` en todo el repo. Exporta `MOCK_USER_ORDERS`, mock legacy no usado por ninguna página. |
| `lib/data/products.ts` | — | Comentario propio en el archivo: `// Legacy mock data — kept for reference only. All pages now fetch from Supabase.` Cero imports reales del archivo (todas las páginas usan `lib/supabase/queries/products.ts`). |
| `lib/stripe/client.ts` | 9 | Cero imports de `stripe/client` en el repo. Ver nota de dependencia huérfana en 1.2. |
| `lib/utils/calculations.ts` | 18 | Exporta solo `calculateShippingDays`; cero imports. No confundir con `lib/analytics/calculations.ts` (activamente usado, ver 3.4) — son archivos distintos con nombre parecido, no duplicados entre sí. |
| `components/admin/ChipMultiSelect.tsx` | ~90 | Cero imports de `ChipMultiSelect` fuera de su propia definición. |
| `components/ui/accordion.tsx` | — | Cero `import ... from '@/components/ui/accordion'` en el repo (el acordeón de `app/(public)/pedido/[id]/page.tsx` usa markup propio, no este componente). |
| `components/ui/card.tsx` | — | Cero imports del archivo `components/ui/card` (el proyecto tiene su propio patrón de tarjetas inline en la mayoría de páginas; este primitive de shadcn nunca llegó a integrarse). |

**Scripts standalone marcados como "sin uso" por `knip`** (no se recomienda borrar, son scripts operativos ejecutados manualmente, no importados por la app):
`scripts/apply-migrations.ts`, `scripts/create-admin.ts`, `scripts/seed-affiliates.ts`, `scripts/seed-categories.ts`, `scripts/seed-productos-sheet.js`. Ninguno está referenciado en `package.json#scripts`; si ya no se usan operativamente, confirmar con el equipo antes de borrar (bajo riesgo, pero no es "código muerto" en el sentido de dead code de producción).

### 2.2 Exports individuales sin uso externo (CAREFUL — requieren confirmación de producto antes de borrar)

`knip`/`ts-prune` reportan 133 exports sin importador externo. La mayoría son ruido esperado en este stack (variantes de componentes shadcn como `DialogClose`, `DropdownMenuLabel`, `SelectGroup`, `badgeVariants`, etc., y tipos de dominio en `types/index.ts`/`types/crm.ts` que reflejan el esquema de Supabase por adelantado a features futuras — **no se recomienda tocar estos**, es un patrón normal en proyectos Next.js + shadcn + Supabase).

Los siguientes sí destacan como funciones de negocio completas, exportadas y sin ningún importador, verificadas con grep (no falso positivo de shadcn/tipos):

| Archivo | Export | Última modificación |
|---|---|---|
| `lib/supabase/queries/userOrders.ts:87` | `getOrderById` | — |
| `lib/supabase/queries/customers.ts:525` | `listCustomerRecentOrders` | — |
| `lib/supabase/queries/adminRoles.ts:13` | `getAdminRoleById` | — |
| `lib/supabase/queries/adminUsers.ts:4,37` | `getAdminUsers`, `getUserById` | 2026-07-17 (tocado recientemente, posible WIP) |
| `lib/supabase/queries/userCoupons.ts:20,32` | `markCouponUsed`, `grantCouponToUser` | 2026-04-14 |
| `lib/supabase/queries/settings.ts:16` | `getSetting` | — |
| `lib/supabase/queries/media.ts:6` | `uploadMedia` | — |
| `lib/inventory/stock-status.ts:39` | `computeStorefrontStockStatus` | 2026-04-16 |
| `lib/affiliate/cookie.ts:3,4,17` | `REFERRAL_COOKIE_NAME`, `REFERRAL_TTL_SECONDS`, `clearReferralCookie` | 2026-04-24 |
| `lib/data/mexico-locations.ts:110` | `listMexicoMunicipalities` | 2026-04-21 |
| `lib/analytics/calculations.ts:1,6,10,15,44,142` | `calculateGrossMargin`, `calculateLTV`, `calculateCAC`, `calculateChurnRate`, `calculateRetentionByCohort`, `detectAnomalies` | 2026-04-29 |
| `lib/utils/format.ts:17,67` | `formatTime`, `formatProductMeta` | — |
| `lib/stores/cart.ts:111` | `cartKey` (re-exportado explícitamente con `export { cartKey }`, solo usado dentro del propio archivo) | — |

Nota sobre `lib/analytics/calculations.ts`: de las 8 funciones exportadas, solo `calculateRFMScore` y `forecastRevenue` están en uso real (importadas por `lib/supabase/queries/analytics.ts`); las otras 6 (margen bruto, LTV, CAC, churn, cohortes, anomalías) no tienen ningún importador. Parece un módulo de analítica construido con más alcance del que terminó consumiendo `app/admin/analytics/page.tsx`. Recomendación: antes de borrar, verificar con el dueño de producto si son parte de un dashboard de analítica planeado a corto plazo — si no, son buenas candidatas a eliminar en bloque junto con sus tests si existen.

Nota sobre `logActivity` y `getDefaultPipeline` en `lib/supabase/queries/crm.ts`: `knip` los reporta como "unused export", pero sí se usan — únicamente dentro del propio archivo (`crm.ts:102,174,214,251,267,323,403,499,530,560`). Es un falso positivo de "no importado desde otro módulo"; no se recomienda tocar, como mucho evaluar si necesitan seguir siendo exports públicos del módulo.

### 2.3 Directiva eslint-disable sin uso

`app/admin/layout.tsx:390` — `{/* eslint-disable-next-line jsx-a11y/media-has-caption */}` ya no dispara ninguna regla (confirmado con `eslint --report-unused-disable-directives`). Se puede quitar el comentario sin efecto funcional.

---

## 3. Duplicación de lógica

### 3.1 Formateo de moneda reimplementado en vez de usar `lib/utils/format.ts`

El proyecto ya tiene `formatPrice(centavos)` centralizado en `lib/utils/format.ts:4-11` (usa `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 })`). Sin embargo, dos páginas reimplementan exactamente la misma lógica con otro nombre:

- `app/admin/clientes/page.tsx:57-59` — `const fmtMXN = (cents) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents ?? 0) / 100)`
- `app/admin/clientes/[id]/page.tsx:67-69` — función `fmtMXN` idéntica, carácter por carácter.

**Sugerencia:** eliminar ambas definiciones locales de `fmtMXN` e importar `formatPrice` desde `@/lib/utils/format` (ajustando el nombre en los call sites, o agregando un alias `export { formatPrice as fmtMXN }` si se prefiere no tocar tantos call sites).

### 3.2 Formateo de fecha corta reimplementado en 4+ lugares

`lib/utils/format.ts:45-51` ya expone `formatDate(dateString)` con las opciones `{ day: '2-digit', month: 'short', year: 'numeric' }`. Se reimplementa la misma lógica (mismas opciones, mismo locale) en:

- `app/admin/usuarios/page.tsx:348-352` — función local `formatDate` idéntica.
- `app/admin/media/page.tsx:36-38` — función local `formatDate` idéntica (incluso mismo nombre, distinta ubicación).
- `app/admin/pedidos/[id]/page.tsx:342-343` — inline: `new Date(order.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })`.
- `app/affiliate/ventas/page.tsx:214` — inline, mismas opciones.

**Sugerencia:** reemplazar las 4 implementaciones locales por `import { formatDate } from '@/lib/utils/format'`. Es la duplicación más clara del reporte (mismo nombre de función en 2 de los 4 casos, sugiriendo copy-paste directo).

### 3.3 Paginación client-side reimplementada 3 veces

Mismo patrón (`Math.max(1, Math.ceil(total / pageSize))` + `slice((page-1)*pageSize, page*pageSize)`) reimplementado de forma independiente en:

- `app/admin/inventario/page.tsx:444-446`
- `app/admin/productos/page.tsx:401-403`
- `components/admin/analytics/RankingTable.tsx:59-60`

No existe ningún hook o util compartido para esto (`find components lib -iname "*pagination*"` no devuelve resultados).

**Sugerencia:** extraer a `lib/hooks/usePagination.ts` — un hook que reciba `items: T[]` y `pageSize` y devuelva `{ page, setPage, totalPages, paginatedItems }`. Bajo riesgo de romper nada porque la lógica es puramente derivada (memoizable).

### 3.4 Paginación server-side (Supabase `.range()`) con la misma fórmula repetida

El mismo cálculo `.range((page - 1) * pageSize, page * pageSize - 1)` aparece en:

- `lib/supabase/queries/customers.ts:110`
- `lib/supabase/queries/adminOrders.ts:43`
- `lib/supabase/queries/adminRefunds.ts:47` (archivo nuevo, en desarrollo activo — no tocar ahora, pero tenerlo en cuenta para cuando se consolide)

**Sugerencia:** extraer un helper `lib/supabase/pagination.ts` con `toRange(page: number, pageSize: number): [number, number]`, usado en las tres queries. Consolidación de bajo riesgo (es una sola línea, pero repetida 3 veces con la misma fórmula exacta que es fácil de desalinear si cambia la convención de paginación en el futuro).

### 3.5 Parsing de CSV subido (papaparse) casi idéntico en 2 endpoints

- `app/api/admin/products/import/route.ts:144-154`
- `app/api/admin/inventory/import/route.ts:78-87`

Ambos hacen exactamente: `Papa.parse<Record<string,string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })` seguido del mismo bloque de manejo de `parsed.errors` devolviendo `{ error: 'CSV inválido', details: [...] }` con status 400. Solo 2 ocurrencias (no llega al umbral de 3+ pedido en el brief, pero se incluye por ser copy-paste literal).

**Sugerencia:** extraer a `lib/server/csv-import.ts` con `parseCsvUpload(text: string)` que devuelva `{ data, errors }` o lance un error tipado, reutilizable también si se agregan más importadores CSV (categorías, cupones, etc.) a futuro.

### 3.6 Export a Excel/CSV (`exceljs`) — sin duplicación real

`exceljs` solo se usa en un archivo (`app/api/admin/analytics/export/[report]/route.ts`), y `papaparse` para export (no solo import) solo aparece ahí también. No se encontraron múltiples implementaciones de export a Excel duplicadas — este punto del brief no aplica como hallazgo, la lógica de export ya está centralizada en un solo endpoint.

---

## 4. Archivos sobredimensionados (umbral del proyecto: 800 líneas)

| Archivo | Líneas |
|---|---|
| `components/admin/productos/ProductForm.tsx` | 2,281 |
| `app/(public)/checkout/page.tsx` | 2,094 |
| `app/admin/productos/page.tsx` | 1,945 |
| `app/admin/inventario/page.tsx` | 1,728 |
| `app/(public)/perfil/page.tsx` | 1,498 |
| `app/admin/affiliates/[id]/page.tsx` | 1,497 |
| `app/admin/clientes/page.tsx` | 1,480 |
| `app/admin/pedidos/page.tsx` | 1,141 |
| `app/admin/media/page.tsx` | 1,120 |
| `app/(public)/producto/[slug]/ProductDetailClient.tsx` | 1,114 |
| `lib/supabase/queries/analytics.ts` | 1,095 |
| `app/admin/usuarios/page.tsx` | 1,036 |
| `app/admin/analytics/page.tsx` | 902 |
| `app/admin/configuracion/page.tsx` | 841 |

14 archivos superan las 800 líneas (umbral definido en las reglas del proyecto). Los tres primeros (`ProductForm.tsx`, `checkout/page.tsx`, `admin/productos/page.tsx`) superan las 1,900 líneas y son los candidatos más claros para dividir por sub-secciones (formularios de producto por pestaña/variantes, pasos de checkout, tabla+filtros+modales de productos respectivamente). No se incluye plan de refactor detallado aquí porque excede el alcance de esta auditoría (solo detección); se recomienda un pase de **planner** dedicado si se decide dividirlos.

---

## 5. Limpieza menor (TODOs / console.log / comentarios)

### 5.1 TODOs / FIXMEs (2 en todo el código de producción)

- `app/api/affiliate/notify-payment-completion/route.ts:53` — `// TODO: wire to Resend/email service when /api/email/send is implemented`
- `lib/stores/favorites.ts:13` — `// TODO: Replace with Supabase queries when connected`

Ambos parecen deuda técnica real y documentada (no ruido), no requieren limpieza sino resolución de producto.

### 5.2 `console.log` residual en código de producción

- `app/api/admin/orders/[id]/route.ts:121` — `console.log('[attribution] admin confirm', id, result)`. Único `console.log` encontrado fuera de scripts/tests/rutas `dev`. Candidato a quitar o convertir a `console.error`/logger estructurado si el dato es útil para debugging en prod.

### 5.3 Código comentado grande (bloques de 6+ líneas de comentario)

Se inspeccionaron todos los bloques de 6+ líneas consecutivas de comentarios fuera de `.next/` (build artifacts, ignorados). **Ninguno resultó ser código muerto comentado** — todos son JSDoc/documentación legítima explicando decisiones de diseño (ej. `lib/stripe/server.ts:3-9` explica por qué el cliente Stripe es lazy-init, `lib/supabase/queries/customers.ts:199-205` documenta el propósito de `resolveOrCreateCustomerId`, `app/api/admin/products/import/template/route.ts:4-19` documenta el formato del CSV). No hay hallazgo aquí — el codebase está limpio en este aspecto.

---

## Resumen de riesgo por categoría

| Categoría | Nivel | Acción sugerida |
|---|---|---|
| 6 dependencias no usadas (1.1) | SAFE | Quitar de `package.json` y correr `npm install` + `npm run build` + `npm test` |
| `@stripe/stripe-js` (1.2) | CAREFUL | Confirmar que no hay plan de Stripe Elements client-side antes de quitar junto con `lib/stripe/client.ts` |
| 7 archivos muertos (2.1) | SAFE (ya verificados con grep, cero imports) | Borrar y correr build+tests |
| Scripts standalone (2.1) | CAREFUL | Confirmar con equipo de ops si siguen en uso manual |
| ~13 exports de negocio sin uso (2.2) | CAREFUL | Confirmar con dueño de producto antes de borrar (varios parecen funcionalidad planeada, no descartada) |
| Exports de shadcn/tipos de dominio (2.2) | NO TOCAR | Ruido esperado del patrón shadcn + tipos espejo de Supabase |
| 1 eslint-disable sin uso (2.3) | SAFE | Quitar comentario |
| 5 casos de duplicación (3.1–3.5) | SAFE, bajo riesgo | Consolidar uno a la vez, con test antes/después de cada consolidación |
| 14 archivos > 800 líneas (4) | Fuera de alcance de esta auditoría | Requiere sesión de refactor dedicada (usar agente **planner**) |
| 2 TODOs + 1 console.log (5) | SAFE | Resolver o quitar en una pasada rápida |
