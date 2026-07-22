# Programa de Lealtad y Gamificación ("Nurei Coins") — Diseño

## Contexto

Nurei no tiene sistema de puntos/lealtad hoy. Existe infraestructura reutilizable:
- Motor de cupones (`lib/server/coupons/engine.ts`) y tabla `user_coupons` (cupón asignado a un usuario, con `used_at`/`order_id`) — se reutiliza para los cupones de nivel-up, no se crea tabla nueva para eso.
- Webhook de Stripe (`app/api/webhooks/stripe/route.ts`) marca la orden como `paid` y registra uso de cupón — es el punto de extensión natural para otorgar puntos.
- Sistema de reembolsos con reversión de "ledger effects" (comisiones de afiliados) al fallar un refund — mismo patrón se replica para puntos.
- RPCs atómicos existentes (`claim_coupon_atomic`, `process_affiliate_payout_atomic`) — se sigue el mismo patrón para puntos.
- Checkout permite compra de invitado (sin cuenta) — el sistema de lealtad y su widget solo aplican a usuarios autenticados.

## Alcance del MVP

**Incluido:**
- Ganancia de puntos por: crear cuenta (100 pts, una vez) y compras (10 pts por cada $10 MXN gastados, aplicando multiplicador de nivel).
- 5 niveles de lealtad basados en puntos **lifetime** (histórico, nunca baja al canjear).
- Cupón de descuento al subir de nivel (reutiliza `user_coupons`).
- Ruleta "Wheel of Snacks" activada por monto de carrito, premios sin inventario físico.
- Canje de puntos como descuento en checkout (tasa fija, acumulable con cupones).

**Explícitamente fuera de este MVP** (se agregan después sin romper esta arquitectura):
- Puntos por cumpleaños.
- Puntos por compartir/seguir en redes sociales.
- Puntos por reseña de producto con foto (requiere sistema de reseñas que no existe).
- Envío gratis como perk permanente de nivel (se evalúa agregar a futuro en un nivel alto, una vez probado el sistema).
- Premio de "snack físico gratis" en la ruleta (requiere integración con fulfillment/inventario).
- Perk exclusivo específico del nivel Leyenda (queda marcado como pendiente de definir).

## Niveles de lealtad

Basado en AOV ~$300-400 MXN (≈1 pt por peso vía la regla de compra):

| Nivel | Puntos lifetime | Pedidos aprox. para llegar | Beneficios | Cupón nivel-up |
|---|---|---|---|---|
| Curioso | 0 – 999 | Cuenta + 1-2 pedidos | Base | — |
| Antojadizo | 1,000 – 2,499 | ~3-4 pedidos | Base | $25 MXN |
| Fanático | 2,500 – 6,499 | ~8-9 pedidos | 1.2x multiplicador de puntos + acceso anticipado a "Nuevos Drops" | $75 MXN |
| Snack Lover | 6,500 – 17,499 | ~19-20 pedidos | 1.5x multiplicador + regalo exclusivo por pedido | $150 MXN |
| Leyenda | 17,500+ | ~50 pedidos | 1.5x multiplicador + regalo exclusivo por pedido + perk exclusivo top (TBD post-MVP) | $250 MXN |

El nivel se recalcula sobre `lifetime_points`, nunca sobre el saldo canjeable — canjear puntos no baja de nivel.

## Datos y backend

### Tablas nuevas

```sql
-- 1 fila por usuario: estado actual
loyalty_points (
  user_id uuid primary key references auth.users(id),
  balance integer not null default 0,        -- saldo canjeable
  lifetime_points integer not null default 0, -- histórico, define el nivel
  tier text not null default 'curioso',       -- calculado, denormalizado para queries rápidas
  active_multiplier_expires_at timestamptz,   -- ventana del x2 de la ruleta, si aplica
  updated_at timestamptz not null default now()
)

-- historial inmutable, fuente de verdad
loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  delta integer not null,                     -- + o -
  reason text not null,                       -- 'signup' | 'purchase' | 'redemption' | 'wheel_prize' | 'refund_reversal' | 'tier_up_bonus'
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
)

-- giros de ruleta
wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cart_session_id text not null,              -- vincula el giro a una sesión de carrito, evita re-giros
  prize_type text not null,                   -- 'discount_pct' | 'free_shipping' | 'points_multiplier_2x' | 'no_prize'
  prize_value numeric,
  spun_at timestamptz not null default now(),
  applied_order_id uuid references orders(id) -- se llena cuando el premio se usa en un pedido
)
```

RLS: usuario solo lee sus propias filas (`user_id = auth.uid()`); todas las escrituras pasan por RPCs `security definer`, igual que el patrón de refunds/afiliados — nunca se otorgan puntos ni se resuelve el premio de la ruleta desde el cliente.

### RPCs atómicos

- `award_points_atomic(user_id, delta, reason, order_id)` — inserta en `loyalty_ledger`, actualiza `balance`/`lifetime_points`/`tier` de `loyalty_points` en una transacción. Si el cambio de `tier` cruza un umbral hacia arriba, emite el cupón de nivel-up (insert en `user_coupons` con un cupón preconfigurado por nivel) y una fila adicional en el ledger con `reason='tier_up_bonus'` si aplica bono de puntos (no aplica en este MVP, solo cupón).
- `redeem_points_atomic(user_id, points, order_id)` — valida saldo suficiente y que `points` sea múltiplo de 100; descuenta del `balance` (no afecta `lifetime_points`); inserta fila `reason='redemption'`.
- `resolve_wheel_spin_atomic(user_id, cart_session_id)` — valida que el carrito actual cumple el umbral y que no existe ya un giro sin usar para esa `cart_session_id`; sortea el premio server-side con probabilidades fijas en config; inserta en `wheel_spins`.
- Reversión: el flujo existente de refunds que revierte comisiones de afiliado se extiende para también revertir los puntos de esa orden (`award_points_atomic` inverso, `reason='refund_reversal'`).

## Mecánica de la ruleta ("Wheel of Snacks")

- **Trigger:** carrito ≥ $399 MXN → 1 giro disponible para esa sesión de carrito.
- **Premios (sin inventario físico):** % descuento en el pedido actual, envío gratis en el pedido, multiplicador de puntos x2 por 24h, o "nada esta vez" (probabilidad de premio de consuelo, mantiene valor percibido).
- El resultado se decide en `resolve_wheel_spin_atomic` (servidor), nunca en el cliente.
- El premio queda "pendiente de aplicar" al total del carrito actual (mismo tratamiento que un cupón aplicado) o expira si el carrito se abandona/vacía.

### Reglas anti-invasividad (explícitas, no opcionales)

- La ruleta se auto-abre **como máximo una vez por sesión de carrito** al cruzar el umbral. Si el usuario la cierra sin girar, no vuelve a aparecer sola hasta que complete ese pedido o vacíe el carrito y arme uno nuevo.
- El `LoyaltyWidget` es **pasivo**: nunca se abre solo ni dispara modales. Solo muestra un indicador discreto (punto, sin contador rebotando) cuando hay algo nuevo (giro pendiente, subida de nivel, cupón sin usar).
- El cupón de nivel-up se comunica **una sola vez** vía toast (`sonner`, ya en el stack) en el momento exacto de la subida — no modal bloqueante, no recordatorios repetidos.
- Sin banners persistentes en otras páginas empujando a girar o canjear — toda la interacción vive detrás del clic al widget o del trigger natural del carrito.

## Frontend: componentes y estado

```
components/loyalty/
  LoyaltyWidget.jsx               # botón flotante pasivo + drawer (saldo, nivel, historial, canjear)
  LoyaltyTierBadge.jsx            # badge reutilizable del nivel actual
  GamificationWheel.jsx           # modal de la ruleta, framer-motion + confeti CSS/canvas
  CheckoutLoyaltyRedemption.jsx   # slider/input de canje en checkout

lib/stores/
  loyaltyStore.ts                 # zustand: cache de saldo/nivel/spin pendiente; fuente de verdad es Supabase

lib/supabase/queries/
  loyalty.ts                      # getLoyaltyStatus, getLedgerHistory, getPendingWheelSpin

app/api/loyalty/
  status/route.ts                 # GET saldo/nivel/historial del usuario autenticado
  redeem/route.ts                 # POST canjear puntos → redeem_points_atomic
  wheel/spin/route.ts             # POST girar ruleta → resolve_wheel_spin_atomic

app/api/orders/create/route.ts    # (existente, extendido) aplica pointsDiscount igual que coupon_discount
app/api/webhooks/stripe/route.ts  # (existente, extendido) al marcar orden pagada → award_points_atomic
```

- `LoyaltyWidget` visible solo para usuarios autenticados (`useAuthStore`); oculto en checkout de invitado.

## Checkout: canje de puntos

- Tasa fija: 100 pts = $10 MXN. Mínimo de canje 100 pts, en múltiplos de 100 (evita descuentos de centavos).
- **Acumulable con cupones** (igual que Sephora/Amazon): `total = subtotal + shipping - couponDiscount - pointsDiscount`.
- Validación server-side en `apply` (mismo endpoint o uno hermano a `apply-coupon`): `pointsDiscount ≤ (subtotal - couponDiscount)`, nunca genera total negativo.
- El slider en `CheckoutLoyaltyRedemption.jsx` se limita al saldo disponible, redondeado hacia abajo al múltiplo de 100 más cercano.

## Testing

- Unit: cálculo de nivel a partir de `lifetime_points` (umbrales, casos límite en cada frontera), cálculo de puntos por compra (incluye multiplicador de nivel y multiplicador x2 de ruleta si está activo), validación de canje (mínimo, múltiplos, saldo insuficiente, tope de subtotal).
- Integration: `award_points_atomic` otorga puntos y emite cupón de nivel-up al cruzar umbral (verificar inserción en `user_coupons`); `redeem_points_atomic` rechaza canjes inválidos; reversión de puntos al fallar/completarse un refund.
- E2E: flujo completo — crear cuenta (100 pts) → agregar productos hasta $399 → se auto-abre la ruleta una sola vez → cerrar sin girar → no reaparece en la misma sesión → completar pedido → puntos otorgados vía webhook → nivel sube si corresponde → toast de cupón.

## Riesgos / decisiones abiertas (no bloqueantes para plan de implementación)

- Perk exclusivo del nivel Leyenda: queda como TBD, no bloquea el MVP.
- Envío gratis como perk permanente: pendiente de evaluar en un nivel futuro, fuera de este MVP.
- AOV usado (~$300-400 MXN) es una aproximación del usuario, no un dato medido — si el AOV real difiere significativamente, los umbrales de nivel deberán recalibrarse (es un cambio de configuración, no de arquitectura).
