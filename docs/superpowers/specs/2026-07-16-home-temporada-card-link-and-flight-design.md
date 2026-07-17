# Home "Selección de Temporada" — tarjeta clickeable + animación de carrito

## Contexto

La sección "Selección de Temporada" del home (`app/(public)/HomeClient.tsx`) usa una
`ProductCard` local, distinta de la tarjeta compartida usada en `/menu`
(`components/productos/ProductCard.tsx`). La tarjeta del home:

- No navega al detalle del producto al hacer click (salvo el pill "Ver opciones" en
  productos con variantes, que es un `<Link>` propio).
- Al agregar un producto simple al carrito, no dispara la animación de "círculo
  volando hacia el carrito" (`useAddToCartFlight` + `CartFlightLayer`) que ya existe
  y se usa en el resto del sitio.

`CartFlightLayer` ya está montado globalmente en `app/(public)/layout.tsx`, y el
Header ya expone los targets `data-cart-fly-target="mobile"` y `="desktop"`. No hace
falta tocar esa infraestructura.

## Alcance

Cambios acotados a `app/(public)/HomeClient.tsx`. No se toca la tarjeta de `/menu`,
ni `CartFlightLayer`, ni `lib/stores/cartFlight.ts`, ni `lib/hooks/useAddToCartFlight.ts`.
No se agrega validación de stock por API, favoritos, ni carrusel de imágenes a la
tarjeta del home — se mantiene su apariencia y comportamiento actuales salvo los dos
puntos de abajo.

## Cambios

1. **Import**: agregar `useAddToCartFlight` desde `@/lib/hooks/useAddToCartFlight`
   en `HomeClient.tsx` (`Link` ya está importado).

2. **Tarjeta completa clickeable**: envolver el `motion.div` de `ProductCard` en un
   único `<Link href={`/producto/${product.slug}`}>` exterior, replicando el patrón
   ya usado en `components/productos/ProductCard.tsx`.
   - Productos con variantes: el pill "Ver opciones" deja de ser un `<Link>` anidado
     (un `<a>` dentro de otro `<a>` es HTML inválido) y pasa a ser un `<span>` con el
     mismo estilo visual. El click sigue llevando al detalle porque burbujea al
     `Link` exterior.
   - Productos simples: el botón "Agregar" llama a `e.preventDefault()` y
     `e.stopPropagation()` para no disparar la navegación del `Link` padre al
     agregar al carrito.

3. **Animación de círculo al carrito**: `handleAdd` pasa a recibir el evento del
   click del botón. Se captura `e.currentTarget` como `sourceEl` **antes** de
   cualquier `await` (React limpia `event.currentTarget` tras un yield). Después de
   `addItem(product)` se llama `launchFlight({ sourceEl: sourceButton, quantity: 1 })`.
   El resto de `handleAdd` (toast, estado `added`) no cambia.

## Fuera de alcance

- No se cambia el botón "Ver opciones" a disparar la animación de carrito (los
  productos con variantes van al detalle a elegir variante, no agregan directo).
- No se toca la tarjeta destacada ("Featured Snack") ni el CTA final del home.

## Testing

Verificación manual en navegador (dev server local):

- Click en cualquier zona no interactiva de una tarjeta de "Temporada" navega a
  `/producto/[slug]`.
- Click en "Agregar" en un producto simple: agrega al carrito, dispara el círculo
  animado desde el botón hasta el ícono del carrito (desktop y mobile), y NO navega.
- Click en "Ver opciones" en un producto con variantes: navega al detalle
  (comportamiento ya existente, sin regresión).
- No hay warning de hidratación por `<a>` anidados en consola.
