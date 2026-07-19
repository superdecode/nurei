# Auditoría de Seguridad — nurei
Fecha: 2026-07-18 | Alcance: repo completo (solo lectura)

## Resumen ejecutivo

El repo tiene un nivel de madurez de seguridad notablemente alto: hay evidencia clara de rondas previas de hardening (migraciones `044_critical_rls_fixes.sql`, `20260718153000_production_security_hardening.sql`, `20260718154500_remove_unrestricted_public_writes.sql`) que ya cerraron brechas graves en `orders`, `order_items`, `order_refunds`, funciones `SECURITY DEFINER`, y políticas de "system insert". Sin embargo, se encontraron **4 hallazgos CRÍTICOS** que siguen el mismo patrón que ya se corrigió en otras tablas pero que no se replicó a `user_profiles`, `affiliate_profiles`, `customers` y al sistema de permisos granulares de admin.

---

## CRÍTICA

### C1. Escalada de privilegios: cualquier usuario puede auto-asignarse `role = 'admin'`
**Archivo:** `supabase/migrations/002_rls.sql:172-173`
```sql
create policy "Profiles: users update own" on public.user_profiles
  for update using (id = auth.uid());
```
No hay `with check`, así que Postgres reutiliza el mismo `using` como `with check`: **solo valida que la fila sea la propia**, no qué columnas se modifican. `user_profiles.role` acepta `'customer' | 'admin' | 'affiliate'` (constraint en `012_affiliate_role.sql:9-10`) y `requireAdmin()` (`lib/server/require-admin.ts:14-20`) confía ciegamente en ese campo.

**Explotación concreta:** cualquier usuario autenticado (con la anon key pública + su propio JWT, ambos expuestos en el bundle del cliente) ejecuta:
```
PATCH https://<proj>.supabase.co/rest/v1/user_profiles?id=eq.<su-uuid>
apikey: <anon key>
Authorization: Bearer <su JWT>
{"role":"admin"}
```
y obtiene acceso admin total (todas las rutas `/api/admin/*`), sin pasar nunca por el frontend.

**Corrección:** agregar `with check` explícito que congele `role`/`admin_role_id`, o mover esas columnas a una tabla separada gestionada solo por `service_role`. Ejemplo:
```sql
drop policy "Profiles: users update own" on public.user_profiles;
create policy "Profiles: users update own" on public.user_profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.user_profiles where id = auth.uid())
    and admin_role_id is not distinct from (select admin_role_id from public.user_profiles where id = auth.uid())
  );
```
(o, más simple y robusto: un trigger `BEFORE UPDATE` que revierta `role`/`admin_role_id` si el ejecutor no es `service_role`).

### C2. Fraude financiero: afiliado puede fijar su propia comisión al 100% y su saldo
**Archivo:** `supabase/migrations/015_affiliate_rls.sql:15-16`
```sql
create policy "Affiliate profiles: update own"
  on public.affiliate_profiles for update using (id = auth.uid());
```
Mismo patrón: sin `with check` por columna. `affiliate_profiles` tiene `commission_coupon_pct`, `commission_cookie_pct`, `pending_payout_cents`, `total_earned_cents` (`013_affiliate_tables.sql:6-17`).

**Explotación concreta:** un afiliado hace `PATCH .../affiliate_profiles?id=eq.<su-uuid>` con `{"commission_coupon_pct": 100}`. En `lib/server/affiliate-attribution.ts:69-76`, cada compra futura con su cupón consulta ese campo **en vivo** para calcular la comisión (`couponCommissionPct = profile?.commission_coupon_pct ?? 0`), así que a partir de ese momento cobra el 100% del ingreso neto en cada venta atribuida, y el pago se procesa vía `process_affiliate_payout_atomic` (que confía en `affiliate_attributions.commission_amount_cents`, ya "envenenado" en el insert). También puede inflar directamente `pending_payout_cents`/`total_earned_cents` para alterar lo que ve el admin en el dashboard de afiliados.

**Corrección:** igual que C1 — `with check` que impida modificar columnas de comisión/saldo desde el rol `authenticated`, dejando solo `bio`/datos bancarios editables por el propio afiliado (que además ya está bien filtrado a nivel de aplicación en `app/api/affiliate/profile/route.ts:81-89`, pero eso no protege contra un ataque directo a PostgREST).

### C3. Manipulación de saldo/segmento de cliente vía API de Supabase directa
**Archivo:** `supabase/migrations/006_customers.sql:275-277`
```sql
create policy "Customers: self update" on public.customers
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
```
El `with check` existe pero repite la misma condición de fila, no restringe columnas. `customers` incluye `store_credit_cents`, `loyalty_points`, `segment`, `risk_level`, `is_verified`, `tags`, `total_spent_cents` (`006_customers.sql:57-72`).

**Explotación concreta:** un cliente hace `PATCH .../customers?id=eq.<su-id>` (o vía `user_id`) con `{"store_credit_cents": 999999999, "segment":"vip", "risk_level":"normal", "is_verified":true}`. Hoy `store_credit_cents`/`loyalty_points` no se consumen en checkout (confirmado por grep: solo aparecen en `lib/validations/customer.ts` y `lib/supabase/queries/customers.ts`), así que el impacto inmediato es de integridad de datos y señales de fraude (un cliente marcado `risk_level: high` por el admin puede auto-limpiarse), pero se vuelve **directamente monetario** en cuanto se implemente redención de store credit en el checkout.

**Corrección:** mismo patrón de `with check` con columnas congeladas, o separar estos campos "operativos" a una tabla que solo `service_role` pueda escribir.

### C4. El sistema de permisos granulares de admin (`admin_roles`) es decorativo — cualquier admin puede escalar a "total" en todos los módulos
**Archivos:**
- `lib/server/require-admin-permission.ts:19-50` (implementación correcta, pero casi sin usar)
- `app/api/admin/roles/route.ts:6-30` y `app/api/admin/roles/[id]/route.ts:6-39` — crean/editan roles y sus `permissions` JSON usando solo `requireAdmin()`
- `app/api/admin/users/[id]/route.ts:10-41` + `lib/supabase/queries/adminUsers.ts:47-62` — permite `PATCH` de `role` y `admin_role_id` de **cualquier usuario** (incluido el propio) usando solo `requireAdmin()`

De las 90 rutas de `/api/admin/*`, **solo el módulo `reembolsos`** usa `requireAdminPermission()`. Todas las demás (`roles`, `configuracion`, `usuarios`, `pagos`, `afiliados`, `marketing`, `crm`, etc.) solo verifican `role === 'admin'` sin mirar el nivel de permiso (`sin_acceso/lectura/escritura/total`) configurado en `admin_roles.permissions` (ver seed en `004_admin_roles_inventory.sql:75-80`, donde por ejemplo un rol tiene `"roles":"sin_acceso","configuracion":"sin_acceso"`).

**Explotación concreta:** una cuenta admin de bajo privilegio (p. ej. soporte, con `roles: sin_acceso` y `usuarios: sin_acceso` en su `admin_role`) puede, aun así, invocar directamente:
- `PATCH /api/admin/roles/[id]` para poner `permissions: {"*": "total"}` en cualquier rol, o
- `PATCH /api/admin/users/[su-propio-id]` con `{"admin_role_id": "<uuid-de-un-rol-total>"}`

y convertirse en super-admin sin que la UI se lo permita, porque el enforcement real vive únicamente en el frontend/rutas de navegación, no en la API.

**Corrección:** reemplazar `requireAdmin()` por `requireAdminPermission(modulo, nivel)` en todas las rutas administrativas sensibles, con especial prioridad en `roles`, `usuarios`, `configuracion`, `pagos`, `afiliados`. Además, bloquear explícitamente que un admin modifique su propio `role`/`admin_role_id` (self-service de permisos) incluso con nivel "total".

---

## ALTA

### A1. CSV/Formula Injection en exportaciones de admin
**Archivos:** `lib/supabase/queries/customers.ts:611-615` (`exportCustomersCsv`) y `app/api/admin/orders/export/route.ts:12-17` (`csvEscape`)
El escape solo cubre comillas/comas/saltos de línea, no neutraliza celdas que empiezan con `= + - @`. `full_name`, `customer_name`, `delivery_address` son datos capturados en checkout público sin restricción de caracteres. Un atacante puede registrar un pedido con un `customer_name` que empiece con una fórmula y, si un admin abre el CSV exportado en Excel/Sheets, se ejecuta.

**Corrección:** anteponer `'` (comilla simple) a cualquier valor que empiece con `=`, `+`, `-`, `@`, `\t`, `\r` antes de escribirlo en el CSV.

### A2. `image/svg+xml` permitido en subida de media sin sanitizar
**Archivo:** `app/api/admin/media/route.ts:19-25`
SVG puede contener `<script>`/`on*` handlers. Mitigado parcialmente porque el bucket se sirve desde el subdominio de Supabase Storage (origen distinto al del sitio, ver `next.config.ts:52-56`) y la subida requiere `requireAdmin()`, pero sigue siendo un vector de XSS almacenado si el archivo se abre directamente o se referencia en un iframe/nueva pestaña.

**Corrección:** quitar `image/svg+xml` de `ALLOWED_MIME_TYPES`, o sanitizar con DOMPurify (perfil SVG) antes de subir.

---

## MEDIA

### M1. Rate limiting en memoria no es efectivo en despliegue serverless
**Archivo:** `lib/server/rate-limit.ts:1-42`
El `Map` en memoria no se comparte entre instancias/regiones de Vercel ni sobrevive cold starts. Un atacante que golpee distintas instancias lambda (alto tráfico, distintas regiones edge) elude el límite en login, checkout, forgot-password, etc.
**Corrección:** usar un store distribuido (Upstash Redis, `@upstash/ratelimit`) para producción.

### M2. `getClientIp` puede ser manipulable por el cliente
**Archivo:** `lib/server/rate-limit.ts:48-54`
Toma `x-forwarded-for.split(',')[0]`, que es el primer salto — si el proxy de la plataforma **agrega** (no sobrescribe) el header, un cliente puede anteponer su propio valor falso. Verificar que Vercel efectivamente sobrescribe/ignora el XFF entrante del cliente; si no, usar el header específico de la plataforma o tomar el último salto de confianza.

### M3. Idempotencia del webhook de Stripe basada solo en operaciones individuales, sin tabla de eventos procesados
**Archivo:** `app/api/webhooks/stripe/route.ts:19-174`
La firma se valida correctamente (`stripe.webhooks.constructEvent`, body crudo) — bien. No hay una tabla `processed_stripe_events` que dedupe por `event.id`; cada rama confía en que la operación de negocio sea idempotente (lo son: `record_attribution_atomic` tiene `on conflict (order_id) do nothing`, el email usa clave por orden, `orders.update` es idempotente por valor). El único efecto secundario no-idempotente es el `insert` en `order_updates` (línea 56-62, 127-133), que duplicará filas de historial en reintentos de Stripe — no es explotable, pero rompe el principio de "verificar idempotencia por event.id" recomendado por Stripe.
**Corrección (defensa en profundidad):** insertar `event.id` en una tabla con constraint único al inicio del handler y salir temprano si ya existe.

### M4. Fuga de mensajes de error internos al cliente (patrón amplio)
Docenas de rutas devuelven `error instanceof Error ? error.message : ...` directamente en la respuesta HTTP (ej. `app/api/admin/categories/route.ts:23-24`, `app/api/payment/create-checkout/route.ts` catch final, `app/api/admin/roles/route.ts:26-28`). Esto puede exponer nombres de tablas/columnas/constraints de Postgres o detalles internos de Stripe al cliente.
**Corrección:** loguear el error completo en servidor y devolver un mensaje genérico al cliente en rutas donde el mensaje no sea ya user-safe (ya lo hacen bien en varias rutas de checkout).

### M5. CSP con `'unsafe-inline' 'unsafe-eval'` en `script-src`
**Archivo:** `next.config.ts:21`
Reduce la defensa en profundidad contra XSS (aceptable como trade-off típico de Next.js, pero documentar la excepción). Considerar CSP basada en nonces si el roadmap lo permite.

### M6. Dependencia transitiva con vulnerabilidad moderada (`npm audit`)
`postcss <8.5.10` (bundled dentro de `next`) — XSS vía `</style>` sin escapar en el stringify de CSS. Severidad moderada, herramienta de build interna de Next, no directamente alcanzable por input de la app. `npm audit fix --force` degradaría `next` a una versión muy antigua (rechazar). Monitorear actualización de Next.js.

---

## BAJA

### B1. Enlaces en descripciones de producto (DOMPurify) sin `rel=noopener/noreferrer` forzado
**Archivo:** `app/(public)/producto/[slug]/ProductDetailClient.tsx:609,923`
`ALLOWED_ATTR: ['href','target','rel']` permite que el admin (autor del contenido) omita `rel`, dejando un riesgo menor de tabnabbing si el link abre en `target=_blank`. Bajo impacto porque el contenido lo genera un admin de confianza.

### B2. Cobertura inconsistente de Zod
99 de 129 rutas no usan Zod (import directo con `body = await request.json()` + validación manual). Las rutas críticas revisadas (`orders/create`, `payments/process`, `payment/create-checkout`) tienen validación manual sólida y sin problemas encontrados, pero la inconsistencia aumenta el riesgo de que una ruta nueva se agregue sin validar correctamente. Recomendado, no urgente: estandarizar con Zod.

---

## Lo que está bien (no requiere acción)

- RLS habilitado en todas las tablas sensibles (confirmado listado completo de `create table` vs `enable row level security`); `order_items`/`order_refunds` ya se corrigieron en `044_critical_rls_fixes.sql`.
- Política de inserción de `orders` ya restringida a `status='pending', payment_status='pending', user_id propio o null` (`044_critical_rls_fixes.sql:39-45`).
- `proxy.ts` (middleware) hace un primer filtro de sesión razonable y delega verificación de rol a las rutas — correcto, no confía solo en el cliente.
- `requireAdmin()`/`requireAdminPermission()` (`lib/server/require-admin*.ts`) consultan el rol vía `service_role`, no vía JWT claims falseables.
- Webhook de Stripe valida firma sobre body crudo antes de parsear — correcto.
- `payment/create-checkout` y `orders/create` recalculan precios/stock/envío server-side, ignoran totales del cliente.
- Anti-enumeración correcta en `forgot-password` y `admin-login` (mismos mensajes de error).
- Sin secretos hardcodeados en código; `.env.example` solo tiene placeholders.
- Sin `eval`/`child_process`/CORS abierto encontrados.
- Contenido rich-text de guías (`lib/content/guias/rich-text.tsx`) usa un mini-parser seguro sin `dangerouslySetInnerHTML`.

---

## Resumen ejecutivo (conteo)

**4 CRÍTICOS, 2 ALTOS, 6 MEDIOS, 2 BAJOS.**

Los 3 más urgentes:
1. **RLS de `user_profiles` sin restricción de columnas** — cualquier usuario logueado puede auto-asignarse `role='admin'` directo vía la REST API de Supabase (bypasea todo el frontend). `supabase/migrations/002_rls.sql:172-173`.
2. **Sistema de permisos granulares de admin bypasseado** — solo el módulo "reembolsos" usa `requireAdminPermission()`; cualquier cuenta `role='admin'` (aunque tenga permisos limitados) puede editar roles/permisos o reasignar `admin_role_id` propio vía `app/api/admin/roles/[id]/route.ts` y `app/api/admin/users/[id]/route.ts`, escalando a super-admin.
3. **RLS de `affiliate_profiles` sin restricción de columnas** — un afiliado puede fijar su propio `commission_coupon_pct` al 100% directo vía REST API; `lib/server/affiliate-attribution.ts` lee ese campo en vivo en cada atribución, generando fraude financiero real. `supabase/migrations/015_affiliate_rls.sql:15-16`.
