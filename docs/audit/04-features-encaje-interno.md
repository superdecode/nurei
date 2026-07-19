# 04 - Encaje interno de 3 features nuevas en nurei

Análisis de arquitectura de solo lectura. Next.js 16 (App Router), React 19, Supabase (RLS), Stripe, Resend, sistema de afiliados. Todos los nombres de columna, rutas y patrones citados fueron verificados contra el código real.

## Contexto arquitectónico verificado (hechos, no supuestos)

- **Tabla `orders`** (`001_schema.sql` L75-106) ya tiene: `id`, `short_id` (folio público `NUR-#####`, ver `20260718170000_order_folio_nurei_prefix.sql`), `user_id` (FK `auth.users`, nullable para invitados), `customer_name`, `customer_phone`, `customer_email`, `customer_id` (FK `customers`, añadida en `006_customers.sql`), `status` (`pending|confirmed|shipped|delivered|cancelled|failed`), `shipped_at`, `delivered_at`, `items` jsonb.
- **Tracking ya existe parcialmente**: `037_orders_tracking.sql` añadió `tracking_number text` y `carrier text`. **Faltan** `tracking_url` y no hay backfill de `shipped_at` en flujo manual.
- **La ruta PATCH `app/api/admin/orders/[id]/route.ts` ya soporta un "tracking-only update path"** (L49-58): actualiza `tracking_number`/`carrier` sin transición de estado. Y al pasar a `shipped`/`ready_to_ship` ya dispara `sendOrderStatusEmail(id, 'shipped')` (L132-153), que lee `tracking_number` y `carrier` (`send-order-emails.ts` L312, L334-335). **El email "va en camino" ya está construido**: `renderOrderShippedHtml`.
- **Patrón bulk/selección ya existe** en `app/admin/pedidos/page.tsx`: `selectedIds: Set<string>` (L207), `toggleSelect`/`toggleSelectAll` (L424-430), checkbox de header con estado indeterminado (L659-663), y acción masiva condicional "Surtido (N)" (L477-481). El mismo patrón está en `productos`, `clientes`, `inventario`, `cupones`, `affiliates`, `media`. **Este es el patrón a replicar para asignación masiva de guías.**
- **RLS de orders** (`002_rls.sql` L64-74): `users read own` (`user_id = auth.uid()`), lectura por id para tracking de invitado (`using (true)`), `anyone can create`, `admin update` (`public.is_admin()`). Función `public.is_admin()` es el guard estándar de RLS admin (usada en todo `046_crm_module.sql`).
- **Módulo CRM (`046_crm_module.sql`) es la plantilla de referencia canónica** para una tabla nueva con RLS admin: usa `gen_random_uuid()`, `handle_updated_at()` trigger, enums vía `check (... in (...))`, índices por FK y por `created_at desc`, políticas `for all using (public.is_admin()) with check (public.is_admin())`, y seed en bloque `do $$`.
- **Permisos granulares admin**: `admin_roles.permissions` es jsonb con claves por dominio (`pedidos`, `reembolsos`) y valores `total`/`sin_acceso` (`052_fix_reembolsos_permission_seed.sql`). Toda feature admin nueva debe seedear su clave de permiso.
- **Emails**: `lib/email/send-order-emails.ts` centraliza Resend con `idempotencyKey`, resolución de remitentes admin por preferencia (`getInternalRecipientsByPreference`), y `EMAIL_FROM`/`EMAIL_REPLY_TO`. Templates HTML puros en `lib/email/templates/`. `getInternalRecipientsByPreference` filtra por `notification_prefs.email_on_new_order` y permiso `pedidos != sin_acceso`.
- **Layout raíz** (`app/layout.tsx` L160-187): `<body>` renderiza `{children}` + `<Toaster>` + `<Analytics>` + `<ServiceWorkerCleanup>` + `<WebVitalsTracker>`. Es el punto de montaje global de widgets. Fuentes con `display:'optional'` para evitar CLS (patrón ya consciente de layout shift).
- **WhatsApp actual**: solo un link estático en `components/layout/Footer.tsx` L73 ("Soporte WhatsApp"). No hay widget flotante ni número centralizado en config accesible a cliente (el número vive en config de tienda/perfil).
- **Nav admin**: `app/admin/layout.tsx` `NAV_ITEMS` (L27+) + `AdminTopBar.tsx` navItems + `AdminWorkspaceTabs` (sistema de tabs tipo navegador con `openTab`/`closeTab`). Añadir sección admin = añadir entrada en ambos arrays + carpeta `app/admin/<x>/`.
- **`customers`** (`006_customers.sql`): `id uuid`, `email`, `user_id`, `customer_id` en orders. Existe además `customer_interactions` con `kind in ('note','call','email','whatsapp','visit','complaint','compliment','system')` — relevante como destino de timeline para PQR.
- **Rutas públicas**: grupo `app/(public)/` con `perfil/`, `pedido/[id]/`, `legal/`, etc. `pedido/[id]` ya soporta acceso por token de invitado (`public_access_token`).

---

## Feature 1 - Botón de contacto rápido (WhatsApp)

### Decisión de fase (ADR resumido)

**Fase 1 (recomendada de arranque): link `wa.me` flotante.** Gratis, cero backend, cero dependencia de Meta Business. Cubre 90% del valor (cliente abre chat con mensaje prellenado).

**Fase 2 (opcional, cuando haya operación de soporte): WhatsApp Cloud API (Meta).** Requiere Meta Business verificado, número dedicado, webhook, plantillas aprobadas. Habilita respuestas automatizadas, CRM y bots. **No adoptar hasta que el volumen lo justifique** — es un salto de complejidad grande (verificación de negocio, gestión de sesiones de 24h, costos por conversación). El link `wa.me` y la Cloud API **no son mutuamente excluyentes**: el botón flotante puede apuntar al mismo número que luego opere la Cloud API.

### Dónde vive

- **Componente nuevo**: `components/layout/WhatsAppFloatingButton.tsx` (Client Component, `'use client'`).
- **Montaje**: en `app/layout.tsx` dentro de `<body>`, junto a `<Toaster>` (después de `{children}`). NO montarlo por página. Alternativa: montarlo en el layout del grupo `(public)` si NO se quiere en `/admin`.
- **Número/mensaje**: leer de `app_config` (mismo patrón `getAppearanceSettings` con `unstable_cache`) o de env `NEXT_PUBLIC_WHATSAPP_NUMBER` para evitar hardcode. El Footer actual (L73) debe reusar la misma fuente de verdad.
- Refactor menor: extraer el número a una util `lib/config/contact.ts` para que Footer y botón flotante no dupliquen el literal.

### Anti-CLS / performance

- **`position: fixed`** (bottom-right) con `z-index` bajo el Toaster; al ser fixed **no participa en el flujo → no genera CLS**.
- Tamaño explícito (ancho/alto fijos) para el icono, evitando reflow al cargar.
- **No bloquear LCP**: es un `<a>` con SVG inline (lucide `MessageCircle`), sin imagen remota ni script de terceros. Nada de embeds de widgets JS pesados (Zendesk/Intercom) que sí dañarían LCP/TBT.
- Diferir aparición con `content-visibility` o montar tras `requestIdleCallback` si se quiere ser estricto, pero para un `<a>` estático es innecesario.
- Respetar `prefers-reduced-motion` en cualquier animación de entrada (coherente con uso de framer-motion en el resto).

### Flujo de datos

```
app_config.store_info.whatsapp (o env NEXT_PUBLIC_WHATSAPP_NUMBER)
   |  (server: unstable_cache 3600s)
   v
RootLayout --pasa numero--> <WhatsAppFloatingButton number msg />
   |
   v
Usuario click --> https://wa.me/<E164>?text=<encodeURIComponent(msg)>
   |
   v
App WhatsApp del usuario (sin backend nurei)
```

### Esfuerzo

- Fase 1 (link `wa.me` flotante + refactor fuente de número): **S**.
- Fase 2 (Cloud API, webhook, plantillas, inbox): **L**. Fuera de alcance recomendado por ahora.

---

## Feature 2 - Sistema de PQR con notificación al admin

### Tabla Supabase (nueva migración `055_pqr_tickets.sql`, sigue plantilla `046_crm_module.sql`)

```sql
create table if not exists public.pqr_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text unique,                    -- folio legible, ej. PQR-000123 (patron short_id)
  tipo          text not null default 'peticion'
                check (tipo in ('peticion','queja','reclamo','sugerencia')),
  estado        text not null default 'abierto'
                check (estado in ('abierto','en_proceso','resuelto','cerrado')),
  prioridad     text not null default 'media'
                check (prioridad in ('baja','media','alta','urgente')),
  asunto        text not null,
  mensaje       text not null,
  -- Identidad del solicitante (cliente logueado O invitado por email)
  user_id       uuid references auth.users(id) on delete set null,
  customer_id   uuid references public.customers(id) on delete set null,
  cliente_email text not null,                  -- siempre presente (fallback invitado)
  cliente_nombre text,
  -- Relacion opcional con pedido
  order_id      uuid references public.orders(id) on delete set null,
  -- Gestion / SLA
  assigned_to   uuid references auth.users(id) on delete set null,
  respuesta     text,                           -- ultima respuesta del admin (o mover a tabla de mensajes en fase 2)
  resuelto_at   timestamptz,
  -- SLA para reporting futuro
  sla_due_at    timestamptz,                    -- created_at + ventana segun prioridad
  first_response_at timestamptz,                -- para medir tiempo de primera respuesta
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_pqr_estado    on public.pqr_tickets(estado);
create index idx_pqr_prioridad on public.pqr_tickets(prioridad);
create index idx_pqr_user      on public.pqr_tickets(user_id);
create index idx_pqr_order     on public.pqr_tickets(order_id);
create index idx_pqr_created   on public.pqr_tickets(created_at desc);
create index idx_pqr_sla       on public.pqr_tickets(sla_due_at) where estado in ('abierto','en_proceso');

drop trigger if exists set_pqr_updated_at on public.pqr_tickets;
create trigger set_pqr_updated_at before update on public.pqr_tickets
  for each row execute function public.handle_updated_at();
```

**Trigger de sincronía de estado** (espejo de `crm_sync_deal_close_state`): al pasar `estado` a `resuelto`/`cerrado`, setear `resuelto_at := coalesce(resuelto_at, now())`; al reabrir, `resuelto_at := null`. Setear `first_response_at` cuando `respuesta` pasa de null a no-null.

**Fase 2 opcional**: tabla `pqr_messages` (hilo de conversación cliente-admin) en lugar del campo `respuesta` único, más `pqr_attachments`.

### RLS (patrón mixto: cliente ve lo suyo + admin ve todo, combinando políticas de `orders` y `crm`)

```sql
alter table public.pqr_tickets enable row level security;

-- Cliente logueado lee sus propios tickets
create policy "PQR: users read own" on public.pqr_tickets
  for select using (user_id = auth.uid());

-- Cliente logueado crea ticket a su nombre; invitado crea via route con service client
create policy "PQR: users create own" on public.pqr_tickets
  for insert with check (user_id = auth.uid() or user_id is null);

-- Admin ve y gestiona todo
create policy "PQR: admin all" on public.pqr_tickets
  for all using (public.is_admin()) with check (public.is_admin());
```

Nota: los tickets de invitado (sin `user_id`) se crean desde el endpoint público usando `createServiceClient()` (mismo patrón que creación de orders de invitado), validando email antes de insertar. El cliente invitado NO puede listar por RLS; consulta su ticket por `ticket_number` vía endpoint con token, análogo a `public_access_token` de orders.

### Formulario público

- **Ruta nueva**: `app/(public)/pqr/page.tsx` (formulario dedicado) + confirmación `app/(public)/pqr/[ticket]/page.tsx` para seguimiento.
- **Acceso contextual adicional** (mejor UX): botón "Reportar un problema" dentro de `app/(public)/pedido/[id]/page.tsx` y en `app/(public)/perfil/` que abre el mismo formulario **con `order_id` prellenado**. Reutiliza un componente `components/pqr/PqrForm.tsx`.
- **Validación**: Zod en el route handler (`app/api/pqr/route.ts` POST) — `tipo`, `asunto`, `mensaje`, `cliente_email` (email válido), `order_id` opcional. Rate limiting en el endpoint (coherente con `security.md`).

### Notificación por correo al admin (reutiliza `lib/email/`)

- **Template nuevo**: `lib/email/templates/pqr-emails-html.ts` -> `renderPqrAdminNotificationHtml(props)` y `renderPqrCustomerAckHtml(props)` (acuse al cliente), usando las constantes de marca ya exportadas (`BRAND_BG`, `BRAND_AMBER`, etc.) y `escapeHtml`.
- **Función nueva**: `lib/email/send-pqr-emails.ts` -> `sendPqrCreatedEmails(ticketId)`, clonando la estructura de `sendOrderConfirmationEmails`: Resend con `idempotencyKey: pqr-created-<ticketId>-{admin|customer}`, remitentes internos vía una variante de `getInternalRecipientsByPreference` filtrando por permiso `pqr` (nueva clave) en vez de `pedidos`, más fallback `PQR_NOTIFY_EMAIL` env.
- Disparo: dentro del POST del route, tras insertar, `await sendPqrCreatedEmails(id)` (await, no fire-and-forget, por el patrón anti-freeze de Vercel ya documentado en el PATCH de orders L142-145).

### Vista admin

- **Nueva sección `app/admin/pqr/page.tsx`** replicando la estructura de `app/admin/pedidos/page.tsx`: tabla con `selectedIds`, tabs por `estado` (Abierto/En proceso/Resuelto/Cerrado) usando el mismo componente de tabs y counts (`/api/admin/pqr/counts`), filtros por `prioridad`/`tipo` con `AnchoredFilterPanel`, drawer de detalle con respuesta y cambio de estado.
- **Queries nuevas**: `lib/supabase/queries/adminPqr.ts` (espejo de `adminOrders.ts`): `listPqr`, `getPqrDetail`, `updatePqrStatus`, `replyPqr`.
- **Rutas API admin**: `app/api/admin/pqr/route.ts` (GET list), `app/api/admin/pqr/[id]/route.ts` (GET/PATCH estado+respuesta), `app/api/admin/pqr/counts/route.ts`. Todas con `requireAdmin()`.
- **Nav**: añadir `{ href: '/admin/pqr', label: 'PQR', icon: MessageSquare }` en `app/admin/layout.tsx` `NAV_ITEMS` y en `AdminTopBar.tsx`. Seedear permiso `pqr` en `admin_roles.permissions` (migración espejo de `052`).
- **Relación con pedido**: en el drawer, si `order_id` presente, link a `/admin/pedidos/<order_id>`; y en el drawer de pedido, mostrar PQR asociados (query por `order_id`). Opcionalmente registrar interacción en `customer_interactions` (`kind='complaint'`) para el timeline del cliente.

### SLA / reporting

- `sla_due_at` calculado al crear según `prioridad` (ej. urgente 4h, alta 24h, media 72h, baja 5d) — constante en `lib/utils/constants.ts`.
- `first_response_at` y `resuelto_at` permiten métricas de "tiempo primera respuesta" y "tiempo de resolución" en `analytics` futuro. Índice parcial `idx_pqr_sla` soporta un badge "vencidos" en el nav (mismo patrón `ordersBadge`).

### Flujo de datos

```
Cliente (publico / perfil / pedido)
   |  POST /api/pqr  {tipo, asunto, mensaje, email, order_id?}
   v  (Zod valida + rate limit)
Route handler --insert--> pqr_tickets (RLS: user_id o service client si invitado)
   |                          | trigger set_sla_due_at, ticket_number
   |                          v
   |--> sendPqrCreatedEmails(id)
   |        |- Resend -> admins (getInternalRecipients filtrado por permiso 'pqr')
   |        `- Resend -> acuse al cliente (idempotencyKey)
   v
Admin /admin/pqr --GET /api/admin/pqr--> listPqr (requireAdmin, is_admin RLS)
   |  PATCH /api/admin/pqr/[id] {estado, respuesta}
   v
updatePqrStatus --> trigger sync resuelto_at/first_response_at
   |
   `--(opc)--> email de respuesta al cliente + customer_interactions(kind='complaint')
```

### Esfuerzo

- Fase 1 (tabla + RLS + form público + email admin/acuse + vista admin básica con estados): **M-L**.
- Fase 2 (hilo `pqr_messages`, adjuntos, métricas SLA en analytics, badge vencidos): **M**.

---

## Feature 3 - Asignación masiva de guías / integración transportadoras

### Estado actual verificado (importante)

Ya existe **el 60% de la fontanería**: columnas `tracking_number`+`carrier`, un **PATCH tracking-only** en `app/api/admin/orders/[id]/route.ts` (L49-58), y el **email "va en camino"** que se dispara al pasar a `shipped` leyendo esas columnas. Lo que falta es (a) `tracking_url` + `shipped_at` explícito en flujo manual, (b) el ingreso **masivo** por CSV/Excel, y (c) el patrón de adaptador para Fase 2.

### Schema - nueva migración `056_orders_shipping_tracking.sql`

```sql
alter table public.orders add column if not exists tracking_url text;
-- tracking_number y carrier ya existen (037). shipped_at ya existe (001).
-- Opcional para Fase 2 (idempotencia / auditoria de proveedor):
alter table public.orders add column if not exists shipping_label_id text;      -- id de la guia en el proveedor
alter table public.orders add column if not exists shipping_provider text;      -- 'envia'|'skydropx'|'manual'|...
```

`shipped_at` debe poblarse en el flujo manual (hoy solo se setea vía `updateOrderStatus` al transicionar). En el bulk assign, al setear tracking + status `shipped`, `shipped_at := now()`.

### Fase 1 - Bulk upload CSV/Excel (sin API)

- **Dependencias ya presentes**: `papaparse` (CSV) y `exceljs` (XLSX). No agregar nada.
- **UI**: en `app/admin/pedidos/page.tsx`, añadir acción masiva "Asignar guías" **junto al patrón existente** de `selectedIds`/"Surtido (N)" (L477-481). Pero el bulk de guías es mejor por **upload de archivo** (no depende de selección): botón "Importar guías" en el header (junto a "Exportar", L482) que abre un modal nuevo `components/admin/pedidos/BulkTrackingImportModal.tsx`.
- **Columnas del archivo**: `folio` (= `short_id`, ej. `NUR-11001`) | `transportadora` (carrier) | `numero_guia` (tracking_number) | `url_tracking` (opcional). Parseo client-side con papaparse; preview con match/no-match antes de confirmar (misma UX de confirmación que el modal de export).
- **Endpoint nuevo**: `app/api/admin/orders/bulk-tracking/route.ts` (POST, `requireAdmin`). Recibe filas parseadas, hace match masivo por `short_id`, y por cada match:
  1. `update orders set carrier, tracking_number, tracking_url, shipped_at=now(), status='shipped'`.
  2. Registra en `order_updates` (audit trail existente).
  3. Dispara `sendOrderStatusEmail(orderId, 'shipped')` — **ya existe, ya incluye tracking**. Con `idempotencyKey` ya presente evita duplicados.
  - Devuelve resumen `{ matched, updated, notFound: [folios], emailsSent }` (envelope de `patterns.md`).
- **Query nueva**: `lib/supabase/queries/adminOrders.ts` -> `bulkAssignTracking(supabase, rows)` que hace un solo round-trip por lote (o `upsert` batched) en vez de N updates, para performance.
- **Validación**: Zod sobre cada fila; folios inexistentes o guías vacías se reportan sin abortar el lote (fail-soft por fila, no por lote).

### Fase 2 - Adaptador de transportadoras (plug-and-play)

Interfaz en `lib/shipping/provider.ts` (patrón Repository de `patterns.md`), **sin acoplar a ningún proveedor**:

```typescript
export interface ShipmentInput {
  orderId: string
  toAddress: ShippingAddress
  parcel: { weightGrams: number; lengthCm?: number; widthCm?: number; heightCm?: number }
  service?: string
}
export interface ShipmentLabel {
  providerLabelId: string
  carrier: string
  trackingNumber: string
  trackingUrl: string
  labelPdfUrl?: string
  costCents?: number
}
export interface TrackingStatus {
  status: 'created'|'in_transit'|'out_for_delivery'|'delivered'|'exception'
  updatedAt: string
  rawStatus?: string
}
export interface ShippingProvider {
  readonly name: string
  createLabel(input: ShipmentInput): Promise<ShipmentLabel>
  getTracking(trackingNumber: string): Promise<TrackingStatus>
  cancelLabel?(providerLabelId: string): Promise<void>
  getRates?(input: ShipmentInput): Promise<Array<{ service: string; carrier: string; costCents: number; etaDays?: number }>>
}
```

- Implementaciones concretas futuras en `lib/shipping/providers/<proveedor>.ts` (Envia, Skydropx, Ship24, EasyPost — **no decidido**), cada una traduce su API al contrato. Factory `lib/shipping/index.ts` -> `getShippingProvider()` selecciona por env `SHIPPING_PROVIDER`.
- El admin (mismo modal/acción) llama a `createLabel` en vez de leer CSV; el resto (persistir `tracking_*`, `shipping_label_id`, email, `order_updates`) es **idéntico** al de Fase 1. Por eso el endpoint `bulk-tracking` debe escribirse en Fase 1 con la escritura desacoplada de la fuente (CSV vs API), para que Fase 2 solo intercambie el productor de filas.
- `getTracking` habilita un cron/webhook futuro para auto-avanzar `shipped -> delivered` (usa `sendOrderStatusEmail(id,'delivered')`, ya existe).
- El peso ya existe en productos (`007_products_shipping_weight.sql`) para alimentar `parcel.weightGrams`.

### Flujo de datos

```
FASE 1 (manual CSV):
Admin sube archivo --> BulkTrackingImportModal (papaparse/exceljs client)
   |  preview match por short_id (NUR-#####)
   v  POST /api/admin/orders/bulk-tracking  [{folio,carrier,guia,url?}]
requireAdmin --> bulkAssignTracking()
   |  update orders(tracking_number,carrier,tracking_url,shipped_at,status='shipped')
   |  insert order_updates (audit)
   |  sendOrderStatusEmail(id,'shipped')  <- YA EXISTE, incluye tracking
   v
resumen {matched, notFound[], emailsSent}

FASE 2 (API):
getShippingProvider() [env SHIPPING_PROVIDER]
   |  provider.createLabel(ShipmentInput)  <- Envia/Skydropx/EasyPost (adaptador)
   v  {trackingNumber, trackingUrl, providerLabelId, labelPdfUrl}
  MISMA escritura que Fase 1 (orders + order_updates + email)
   |
cron/webhook --> provider.getTracking() --> auto delivered + email delivered
```

### Esfuerzo

- Fase 1 (migración `tracking_url`, modal import, endpoint bulk, query batched, reuso de email existente): **M**.
- Fase 2 (interfaz + factory + primer adaptador concreto + cron de tracking): **M-L** (por adaptador). La interfaz sola: **S**.

---

## Resumen de dependencias entre features y riesgos

- **Reuso máximo**: F3 reaprovecha email `shipped` ya existente y el PATCH tracking-only; F2 clona `send-order-emails.ts` + `getInternalRecipientsByPreference` + estructura de `app/admin/pedidos`; F1 reusa `getAppearanceSettings`/config.
- **Patrón admin único a replicar**: `app/admin/pedidos/page.tsx` (selección + tabs + drawer + `AnchoredFilterPanel`) es la plantilla para la vista PQR y para la acción bulk de guías.
- **Plantilla de tabla+RLS**: `046_crm_module.sql` para `pqr_tickets`.
- **Riesgo transversal**: seedear claves de permiso (`pqr`) en `admin_roles.permissions` con migración espejo de `052`, o la sección quedará invisible/abierta según cómo se lea el permiso.
- **Consistencia de folios**: PQR debe usar folio legible propio (`PQR-#####`) siguiendo el patrón `short_id` de orders, no exponer UUID.
