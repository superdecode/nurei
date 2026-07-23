# Integración del Sistema de Lealtad al Perfil — Diseño

## Contexto

El sistema de lealtad ("Nurei Coins", ya implementado y en producción) actualmente se expone al usuario solo vía un botón flotante (`LoyaltyWidget`, icono de regalo) montado en `app/(public)/layout.tsx`. El usuario reporta que este patrón no es el deseado: quiere el sistema integrado directamente en `/perfil`, que ya tiene una arquitectura de tabs consistente (`Pedidos` / `Cupones` / `Direcciones` / `Cuenta`) con un lenguaje visual establecido (tarjetas blancas `rounded-2xl`, acento amarillo `bg-nurei-cta`, `framer-motion` para transiciones, iconos `lucide-react`).

## Alcance

**Incluido:**
- Eliminar `LoyaltyWidget` del layout público (el botón flotante desaparece del sitio).
- Agregar un nuevo tab **"Lealtad"** a la barra de tabs existente en `/perfil`, con su propio ícono (`Award`) y badge (nivel actual abreviado o inicial).
- Agregar una tarjeta clicable de **nivel + progreso** en el header del perfil, entre el avatar y las stats de Pedidos/Favoritos — visible de inmediato al entrar a la cuenta. Al hacer clic navega al tab Lealtad (usando el mismo patrón de navegación por query param `?tab=` que ya usan los otros tabs).
- Contenido del tab Lealtad:
  1. Tarjeta de nivel actual con barra de progreso al siguiente nivel y el multiplicador de puntos del nivel.
  2. Saldo de puntos canjeables.
  3. Historial de movimientos (compras, canjes, bonos, ajustes por reembolso), mismo patrón visual de tarjetas que usa el tab Cupones.

**Explícitamente fuera de alcance (no se toca):**
- El modal de la ruleta (`GamificationWheel`), que se activa por monto de carrito — sigue funcionando exactamente igual, es un componente separado no relacionado al widget flotante que se está removiendo.
- Los cupones de nivel-up: ya aparecen automáticamente en el tab Cupones existente (son cupones normales vía `user_coupons`), no se duplican en el tab Lealtad.
- Cualquier cambio al backend/RPCs/esquema de puntos — esta es una tarea puramente de reorganización de UI, reutilizando `useLoyaltyStore` (Task 10) y `/api/loyalty/status` (Task 9) ya existentes.

## Datos disponibles (ya existentes, sin cambios de backend)

- `useLoyaltyStore` (`lib/stores/loyaltyStore.ts`): `balance`, `lifetimePoints`, `tier`, `history`, `fetchStatus()`.
- `TIER_CONFIG` (`lib/server/loyalty/points.ts`): nombres/umbrales/multiplicadores de los 5 niveles — se necesita una versión de este mapping accesible desde el cliente para calcular "progreso al siguiente nivel" (puntos faltantes, % de la barra). Dado que `lib/server/loyalty/points.ts` está bajo `lib/server/` (convención de este repo para código server-only), se extrae la tabla de tiers a un archivo neutral reutilizable desde cliente y servidor (evita importar código `server/` en un componente `'use client'`).

## Componentes

```
components/loyalty/
  LoyaltyTierCard.tsx      # Reemplaza el uso interno de LoyaltyTierBadge para el header + tab:
                           # tarjeta con nivel, barra de progreso, puntos faltantes al siguiente nivel.
                           # Dos variantes de tamaño: compacta (header) y expandida (tab Lealtad).
  LoyaltyHistoryList.tsx   # Lista de movimientos del historial, estilo tarjeta como TabCupones.

lib/loyalty/
  tiers.ts                 # Mueve TIER_CONFIG (y una función de progreso) a una ruta neutral,
                           # importable tanto desde componentes 'use client' como desde
                           # lib/server/loyalty/points.ts (que re-exporta desde aquí para no
                           # duplicar la tabla ni romper los imports server-side existentes).
```

`app/(public)/perfil/page.tsx` se extiende (no se reescribe): nuevo `TabId` `'lealtad'`, nueva entrada en `TABS`, nueva función `TabLealtad()` siguiendo el patrón de `TabCupones()`, y la tarjeta de nivel en el header usando `LoyaltyTierCard` en su variante compacta.

`app/(public)/layout.tsx`: se remueve el mount de `<LoyaltyWidget />` (queda solo `<GamificationWheel />`).

`components/loyalty/LoyaltyWidget.tsx`: se elimina (ya no se usa en ningún lado tras el cambio de layout).

## Riesgos / decisiones abiertas

- Extraer `TIER_CONFIG` a una ruta neutral es un refactor pequeño pero toca un archivo ya usado por `lib/server/loyalty/engine.ts` y `points.test.ts` (Task 4/5) — se hace vía re-exportación para no romper ningún import existente, no vía búsqueda-reemplazo global.
