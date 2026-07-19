# Investigación externa — WhatsApp, PQR/soporte y envíos (nurei)

Fecha: 2026-07-18
Alcance: investigación web (fuentes citadas) para evaluar 3 funcionalidades candidatas para el e-commerce nurei (Next.js, Stripe, Resend, exceljs/papaparse ya en el stack).

## Nota sobre mercado/moneda

No se encontraron variables de entorno ni configuración de `currency`/`locale` explícitas en el repo que confirmen el país operativo exacto (se revisó `.env.example` y las rutas de checkout/shipping sin hallar el dato). Sin embargo, la lista de transportadoras mencionada en el brief (Coordinadora, Interrapidísimo, Servientrega = Colombia; Estafeta, Paquetexpress = México) sugiere que el negocio opera, o planea operar, en México y/o Colombia. Las recomendaciones de este documento cubren ambos mercados explícitamente y se marcan como "verificar" los puntos que dependen del país real (impuestos, requisitos legales de PQR, tarifas de transportadoras locales).

---

## 1. Botón de contacto WhatsApp para e-commerce

### 1.1 Link `wa.me` vs WhatsApp Business Platform (Cloud API)

| | `wa.me/NUMERO` (link simple) | WhatsApp Business Platform / Cloud API |
|---|---|---|
| Costo | Gratis, sin aprobación | Requiere Meta Business verificado; cobro por mensaje de plantilla (marketing/utility/authentication) |
| Aprobación | Ninguna | Meta Business Manager + verificación de número + revisión de plantillas |
| Funcionalidad | Abre chat con mensaje prellenado; el usuario decide si envía | Chatbots, catálogos, mensajes automatizados, webhooks, múltiples agentes |
| Ventana gratuita | N/A (siempre "gratis" porque no usa la API de Meta) | Ventana de servicio de 24h: una vez el cliente escribe, las respuestas dentro de esas 24h son gratis, sin necesidad de plantilla |
| Ventana extendida | N/A | Si el chat se originó desde un anuncio "Click-to-WhatsApp" o botón CTA de Facebook y la empresa responde dentro de 24h, se abre una ventana adicional de 72h de mensajes gratis |

Cambio importante de modelo de precios: Meta migró de facturación por conversación a **facturación por mensaje de plantilla**, efectivo desde el 1 de julio de 2025. Los mensajes de plantilla se cobran por categoría (marketing, utility, authentication) según el país del destinatario; los mensajes normales dentro de la ventana de servicio de 24h son gratis, no requieren plantilla. Las tarifas varían mucho por país (ejemplos de mercados reportados: EE.UU. marketing ~$0.025 USD, utility ~$0.004 USD; en Alemania/Francia el marketing sube a ~$0.13–0.14 USD). **Verificar pricing directo con Meta/el BSP para México y Colombia**, ya que las tarifas por país no se confirmaron en esta investigación y además el BSP (proveedor intermediario, ej. Twilio, Infobip, 360dialog) añade un markup adicional por mensaje encima de la tarifa base de Meta.

Para un botón de contacto simple (no chatbot, no automatización, no catálogo dentro del chat), el link `wa.me` sigue siendo la opción de menor fricción y costo cero: no requiere aprobación de Meta Business, no genera cargos por mensaje, y es lo que usan la mayoría de tiendas pequeñas/medianas. La Cloud API solo se justifica si nurei necesita: enviar notificaciones automatizadas (confirmación de pedido, envío) por WhatsApp en lugar de o además de email, atender con chatbot/IA, o enrutar a múltiples agentes con una bandeja compartida.

Fuentes:
- [WhatsApp Business API Pricing 2026 — Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
- [WhatsApp Business Platform Pricing (Meta)](https://whatsappbusiness.com/products/platform-pricing/)
- [respond.io — WhatsApp API Pricing 2026](https://respond.io/blog/whatsapp-business-api-pricing)
- Meta for Developers, documentación de pricing (`developers.facebook.com/docs/whatsapp/pricing`) — confirma la migración a facturación por mensaje de plantilla desde el 1 jul 2025 y la ventana de servicio de 24h / entry-point de 72h.

### 1.2 Buenas prácticas de UX para el botón flotante

- Tap target mínimo de 48px+ y evitar que el botón se superponga con navegación, checkout o banners de cookies.
- No mostrarlo sitewide sin criterio: limitarlo a páginas de producto, carrito y checkout reduce el "ruido" sin perder alcance; mostrarlo en páginas donde no hay decisión de compra (ej. blog, políticas) se percibe como intrusivo, especialmente en mobile donde tapa contenido.
- Activarlo por intención: mostrar/ocultar según tiempo en página, % de scroll o intención de salida, en vez de fijo desde el primer render.
- En mercados con altísima penetración de WhatsApp (ej. Brasil, y en general LatAm), el botón flotante se percibe como un canal de contacto esperado y no como un elemento novedoso o intrusivo — esto es un punto a favor para nurei si el mercado es LatAm.
- Sobre CLS/performance: no se encontraron datos técnicos específicos sobre impacto de CLS de estos widgets en las fuentes consultadas; el principio general aplicable es cargar el botón como elemento `fixed`/`sticky` con dimensiones reservadas desde el primer render (evitar que aparezca tras hidratación y desplace contenido), y diferir el SDK de terceros (si se usa un widget con JS externo) con `next/script` en modo `lazyOnload` para no bloquear el hilo principal ni penalizar LCP/TBT.

Fuentes:
- [Infobip — Add a WhatsApp button to your website](https://www.infobip.com/blog/add-whatsapp-button-to-website)
- [ChatCart Pro — The Floating WhatsApp Button](https://www.veloryntech.com/chatcartpro/blog/floating-whatsapp-button)
- [Baymard — Mobile UX Trends 2026](https://baymard.com/blog/mobile-ux-ecommerce)
- [UX Movement — When to Use a Floating CTA Button](https://uxmovement.com/mobile/when-to-use-a-floating-call-to-action-button/)

### 1.3 Alternativas: widgets todo-en-uno (Crisp, Tidio, Chatwoot)

| Herramienta | Open source | WhatsApp nativo | Precio (2026, no verificado directo con proveedor más allá de lo citado) |
|---|---|---|---|
| **Chatwoot** | Sí (MIT), self-host gratis | Sí, bandeja omnicanal (WhatsApp, email, web chat, Telegram, X) | Self-host: gratis (requiere DevOps propio); Cloud: desde ~$19/agente/mes |
| **Crisp** | No | No soporta WhatsApp nativamente (requiere alternativas como Chatwoot/Freshchat) | ~$25/mes hasta 4 agentes, tarifa plana (no por agente) |
| **Tidio** | No | Soporta WhatsApp pero vía conectores de terceros, sin ruteo multi-agente completo en ese canal | Plan gratis limitado; IA (Lyro) add-on $29–$394/mes |

Para nurei, dado que WhatsApp es explícitamente el canal en cuestión, **Chatwoot** es la opción más alineada: es open source (se puede self-hostear sin costo de licencia, aunque sí costo de infraestructura/mantenimiento), tiene integración nativa de WhatsApp (vía Cloud API, no requiere `wa.me` manual) y consolida chat web + WhatsApp + tickets en una sola bandeja, lo que también cubre parcialmente la necesidad de PQR (ver sección 2). Crisp queda descartado si WhatsApp es un requisito porque no lo soporta nativamente.

Fuentes:
- [Chatwoot — Pricing](https://www.chatwoot.com/pricing)
- [buildmvpfast — Chatwoot vs Crisp vs Intercom 2026](https://www.buildmvpfast.com/blog/chatwoot-vs-crisp-vs-intercom-open-source-customer-support-2026)
- [andypartner — Alternativas a Tidio 2026](https://andypartner.com/blog/alternative-to-tidio-2026)

---

## 2. Sistemas de PQR / soporte al cliente

### 2.1 Qué exige/espera el marco legal en LatAm

**Colombia** (Superintendencia de Industria y Comercio, SIC, bajo la Ley 1480 de 2011 — Estatuto del Consumidor): la SIC vigila el cumplimiento del Estatuto del Consumidor y atiende reclamos sobre compras, contratos y servicios tanto en tiendas físicas como en plataformas digitales. Casos típicos que cubre: productos defectuosos con garantía incumplida, artículos comprados online que nunca llegaron, publicidad engañosa, cobros no informados, negación del derecho de retracto/devolución, mala atención sin resolución. Antes de escalar a la SIC se recomienda agotar la vía directa con el proveedor (reclamo escrito, conservando evidencia como emails o chats); si no hay respuesta satisfactoria, se escala a la Superintendencia, que resuelve PQR simples en 15-30 días hábiles según complejidad.

**México** (PROFECO — Procuraduría Federal del Consumidor): para comercio electrónico, PROFECO opera **Concilianet** (conciliación en línea para proveedores con convenio, con audiencias por chat/videoconferencia) y **Conciliaexprés** (versión ágil para casos sencillos, resolución por mensajería o llamada en días). Requisitos para una queja: nombre y domicilio del consumidor, identificación oficial, documentación soporte (facturas, recibos, contratos, publicidad), e identificación del proveedor. PROFECO recomienda a los consumidores capturar pantallas de términos y condiciones al momento de la compra como evidencia.

Implicación práctica para nurei: independientemente del país final, es razonable construir un flujo de PQR con, como mínimo, estos campos/estados:
- **Campos mínimos**: tipo (petición/queja/reclamo), pedido asociado, descripción, adjuntos (fotos/comprobantes), datos de contacto, fecha de radicación, canal de origen (web/WhatsApp/email).
- **Estados mínimos**: radicado → en revisión → requiere info adicional → resuelto → cerrado (con posibilidad de reabrir), y trazabilidad de tiempos de respuesta (para poder acreditar cumplimiento de plazos si un cliente escala a SIC/PROFECO).
- Verificar con asesoría legal local los plazos de respuesta exigidos y si aplica un "libro de reclamaciones" o número de radicado visible obligatorio, ya que esto varía por país y esta investigación no puede confirmarlo sin conocer el país operativo real de nurei.

Fuentes:
- [SIC Colombia — Peticiones, quejas, reclamos, sugerencias y denuncias](https://sedeelectronica.sic.gov.co/atencion-y-servicios-a-la-ciudadania/peticiones-quejas-reclamos-y-denuncias)
- [SIC — Protección al Consumidor](https://www.sic.gov.co/tema/asuntos-jurisdiccionales/proteccion-al-consumidor)
- [Cambio Colombia — Cómo poner una queja ante la SIC](https://cambiocolombia.com/economia/articulo/2025/6/como-presentar-una-queja-ante-la-superintendencia-de-industria-y-comercio-guia-practica)
- [gob.mx/profeco — Proceso y requisitos de Quejas y Denuncias](https://www.gob.mx/profeco/articulos/proceso-y-requisitos-de-quejas-y-denuncias)
- [Concilianet — Profeco](https://concilianet.profeco.gob.mx/Concilianet/inicio.jsp)

### 2.2 Build vs Buy: herramientas existentes

| Herramienta | Modelo | Precio orientativo (2026, verificar directo con proveedor) | Notas |
|---|---|---|---|
| **Zendesk** | SaaS, por agente | Suite Growth ~$55–89/agente/mes | Robusto pero caro para operación pequeña; pensado para 50+ agentes |
| **Freshdesk** | SaaS, por agente | Growth ~$15–18/agente/mes; Pro ~$49–59/agente/mes | Buen punto medio 10-50 agentes; incluye plan free limitado |
| **Help Scout** | SaaS, por usuario | Desde ~$25–30/usuario/mes | Fuerte en soporte "email-first", equipos pequeños |
| **Chatwoot** | Open source self-host / SaaS | Self-host: gratis (+ infraestructura); Cloud desde ~$19/agente/mes | Única open source de la lista; permite no depender de un vendor externo y integrar WhatsApp nativamente (ver sección 1) |

Para un e-commerce del tamaño de nurei, la disyuntiva build-vs-buy se resuelve así:
- **Construir un módulo de PQR desde cero** solo se justifica si se necesita integración muy específica con el modelo de datos de pedidos/usuarios ya existente en la base Supabase de nurei y si el volumen de tickets es bajo (few dozens/mes). Tiene la ventaja de no depender de un tercero ni pagar por agente, pero exige mantener UI de administración, notificaciones y SLA de respuesta con recursos propios.
- **Comprar/adoptar Chatwoot self-hosted** es probablemente el mejor punto intermedio: es gratis en licencia, cubre WhatsApp + web chat + email en una bandeja, y da un sistema de tickets con estados ya maduro, a cambio de asumir el hosting (puede desplegarse en el mismo proveedor donde ya corre la infra de nurei). Si no se quiere gestionar infraestructura adicional, Freshdesk Growth es la alternativa SaaS de menor costo con buena relación funcionalidad/precio para un equipo pequeño.
- Zendesk queda sobredimensionado (y sobrepreciado) para el tamaño actual de nurei; Help Scout es una alternativa razonable si el volumen de soporte es mayormente por email y no por WhatsApp.

Fuentes:
- [Chatwoot — Pricing](https://www.chatwoot.com/pricing)
- [Help Scout — 9 Best Zendesk Alternatives 2026](https://www.helpscout.com/blog/zendesk-alternatives/)
- [getmacha — Help Desk Software Pricing Compared 2026](https://www.getmacha.com/blog/help-desk-software-pricing-compared)

### 2.3 Cómo exponen el punto de contacto otros e-commerce de la región

- **Falabella Colombia**: expone un centro de ayuda y formulario web de PQR (permite adjuntar archivos), además de línea telefónica con opción de WhatsApp (+57 601 587 8002) y línea nacional 01 8000. También publica explícitamente su política de "derecho de retracto" (5 días hábiles en Colombia, 10 días en Chile) en una página legal dedicada.
- **Mercado Libre**: expone soporte vía canal de WhatsApp oficial, chat dentro de la plataforma, redes sociales (Facebook, Twitter/X, Instagram, YouTube) y líneas telefónicas por país.
- **Rappi**: opera principalmente vía app/web; no se encontró un canal de PQR formal documentado en fuentes oficiales dentro de esta búsqueda (los resultados fueron mayormente de sitios de terceros de "reclamos", no de la fuente oficial de Rappi), por lo que no se puede citar con confianza un patrón específico de Rappi.

El patrón consistente en los tres es: **formulario web dedicado + WhatsApp/teléfono + política de devolución/retracto visible en una página legal separada**, no solo un email de contacto genérico. Esto es el estándar mínimo que nurei debería replicar si opera en Colombia o México.

Fuentes:
- [Falabella Colombia — Centro de ayuda](https://www.falabella.com.co/falabella-co/page/centro-de-ayuda)
- [Falabella Colombia — Derecho de retracto](https://www.falabella.com.co/falabella-co/page/derecho-de-retracto)
- [Falabella Colombia — Servicio al cliente](https://www.falabella.com.co/falabella-co/page/servicio-al-cliente?staticPageId=13000002)

---

## 3. Integración con plataformas de envío/paquetería (LatAm)

### 3.1 Agregadores multi-transportadora

| Agregador | Cobertura LatAm confirmada | Transportadoras relevantes | Notas de integración |
|---|---|---|---|
| **Envia.com / envia.co** | México, Colombia, USA, Brasil, Argentina, Chile, Guatemala, España, Italia, Francia (según su propia web) | +100 transportadoras globales (lista específica no confirmada en esta búsqueda, referida a su guía de "Supported Carriers") | API REST (Curl, Ruby, Python, PHP, Java, Node.js); ambiente sandbox (`api-test.envia.com`) separado de producción (`api.envia.com`); modelo de costos: envia.co reporta un cargo variable de flete del 1% sobre el valor declarado del envío en Colombia — **verificar pricing directo con el proveedor**, ya que no se confirmó una tabla de tarifas fija ni costo mensual |
| **Skydropx** | México (skydropx.com) y Colombia (skydropx.com.co) confirmados con sitios dedicados | +20 transportadoras incluyendo DHL, FedEx, Estafeta, Correos de México (Coordinadora/Interrapidísimo no se confirmaron explícitamente en la documentación revisada para el sitio .co) | API con endpoint `/api/v1/quotations` (cotización, válida 24h) y `/api/v1/shipments` (generación de guía con `quotation_id` + `rate_id`); mensaje propio de "paga solo por lo que envías, sin contratos ni volumen mínimo" — **verificar pricing exacto directo con Skydropx** |
| **Ship24** | Rastreo (no generación de guías) en Colombia: 4-72, Servientrega, Coordinadora, TREGGO; en México: Segmail | Enfocado en tracking multi-transportadora (2500+ carriers/3PLs en 180+ países), no en cotización/generación de guías como Envia/Skydropx | Útil como capa de tracking unificado si ya se generan guías por otro medio, no como agregador de cotización/impresión de etiquetas |
| **EasyPost** | Cobertura declarada en LatAm y México (según su propia web), fuerte en DHL/FedEx/UPS/USPS | No se confirmaron integraciones directas con Coordinadora, Interrapidísimo, Servientrega o Paquetexpress en esta búsqueda | Más orientado a mercado US/global; para las transportadoras locales de Colombia/México específicamente mencionadas por nurei, Envia.com y Skydropx tienen cobertura más directamente confirmada |
| **Shippo** | No se encontró confirmación de cobertura LatAm específica en esta búsqueda | — | Sin evidencia suficiente para recomendarlo en este contexto; **verificar directo con el proveedor** si se quiere considerar |

En síntesis: para las transportadoras que nurei ya mencionó (Coordinadora, Interrapidísimo, Servientrega en Colombia; Estafeta, Paquetexpress en México; DHL/FedEx internacional), **Envia.com y Skydropx son los dos agregadores con presencia de producto dedicada y confirmada en ambos países** (sitios `.com` para México y `.co`/`.com.co` para Colombia). Ship24 y EasyPost son complementarios (tracking) más que sustitutos de la cotización/generación de guías.

Sobre tiempos de aprobación/onboarding: **no se encontraron datos concretos y verificados** de cuánto tarda el alta o aprobación inicial con Envia.com o Skydropx en las fuentes consultadas (mencionan registro y credenciales vía dashboard propio, sin SLA publicado). Recomendación: **verificar tiempo de onboarding directo con cada proveedor** antes de comprometerse a un cronograma.

Fuentes:
- [Envia Shipping API — Introducción (docs.envia.com)](https://docs.envia.com/docs/envia-shipping-api-introduction)
- [Envia.com — Carriers](https://envia.com/en-US/carriers)
- [Envia Colombia — Servicios](https://envia.co/servicios)
- [Skydropx — API docs](https://docs.skydropx.com/)
- [Skydropx — Plataforma de envíos en Colombia](https://www.skydropx.com.co/)
- [Skydropx — Plataforma de envíos en México](https://www.skydropx.com/)
- [Ship24 — Package tracking South Central America](https://www.ship24.com/couriers/south-central-america)
- [EasyPost — Tracking API](https://www.easypost.com/tracking-api/)

### 3.2 Patrón de "carga manual CSV/Excel" como fase intermedia

Herramientas del mercado que resuelven la actualización manual de guías de envío (ej. apps de bulk tracking upload para Shopify) siguen un patrón consistente de columnas mínimas:

1. **Número de pedido/folio** (identificador único, con o sin prefijo `#`)
2. **Número de guía / tracking number**
3. **Transportadora** (nombre exacto o código reconocido por el sistema/plataforma, necesario para poder generar el link de tracking correcto)
4. **Link de tracking** (opcional; si no se provee, algunas plataformas lo generan automáticamente si reconocen la transportadora)
5. Columnas adicionales opcionales: bodega/ubicación de origen (si hay múltiples), fecha estimada de entrega.

Sobre el envío automático del email "tu pedido fue enviado": el patrón estándar (visto en apps de Shopify tipo bulk-tracking-uploader) es que, al hacer el import, el sistema hace **match** entre el folio/número de pedido del CSV y el pedido existente en la base de datos, actualiza su estado a "enviado" con la transportadora y número de guía asociados, y **dispara automáticamente la notificación al cliente en ese mismo paso** (con opción de activar/desactivar el envío de la notificación durante el import, para evitar reenvíos accidentales en cargas de corrección).

Para nurei, que ya tiene **Resend** para email y **exceljs/papaparse** para CSV en el stack, este patrón es directamente portable: un endpoint de import (CSV/XLSX) que reciba folio + transportadora + guía + fecha estimada, actualice el pedido en Supabase, y dispare el email de Resend en el mismo flujo de match — sin necesidad de integrar una API de transportadora todavía. Esto permite operar mientras se gestiona el acceso/aprobación de una cuenta real en Envia.com o Skydropx.

Fuentes:
- [BulkTrack — Upload tracking numbers to orders in bulk via CSV (Shopify App Store)](https://apps.shopify.com/bulktrack)
- [Matrixify — Export & Update Shopify tracking numbers in bulk](https://matrixify.app/tutorials/update-tracking-numbers-for-existing-shopify-orders-in-bulk/)
- [WebToffee — How to Bulk Fulfill Existing Shopify Orders with CSV](https://www.webtoffee.com/docs/storerobo/bulk-fulfill-shopify-orders/)

### 3.3 Recomendación de agregador para empezar

Dado que nurei ya tiene Resend (email) y exceljs/papaparse (CSV) en el stack, la ruta de menor fricción es:

1. **Fase 1 (inmediata, sin dependencia de aprobación de terceros)**: implementar el flujo manual de CSV/Excel descrito en 3.2, reutilizando exceljs/papaparse + Resend. Esto da valor inmediato (email automático de "pedido enviado") sin esperar aprobación de ninguna API externa.
2. **Fase 2 (agregador)**: entre Envia.com y Skydropx, **Skydropx** tiene documentación de API pública más específica y accesible (endpoints de cotización/guía documentados abiertamente en `docs.skydropx.com`, con mensaje explícito de "sin contratos ni volumen mínimo"), lo cual sugiere menor fricción de integración inicial para un equipo pequeño. Envia.com es comparable en cobertura (México + Colombia) y tiene ambiente sandbox separado, lo cual también es una señal de buena experiencia de desarrollador. **Ambos deben cotizarse y confirmarse en paralelo directamente con ventas/soporte antes de decidir**, ya que ninguno publicó tiempos de aprobación ni tablas de precios completas y verificables en esta investigación.

**Verificar pricing y tiempos de onboarding directo con Envia.com y Skydropx** antes de comprometer un plan de implementación con fechas.

---

## Resumen de fuentes citadas (todas)

- https://blueticks.co/blog/whatsapp-business-api-pricing-2026
- https://whatsappbusiness.com/products/platform-pricing/
- https://respond.io/blog/whatsapp-business-api-pricing
- https://developers.facebook.com/docs/whatsapp/pricing
- https://www.infobip.com/blog/add-whatsapp-button-to-website
- https://www.veloryntech.com/chatcartpro/blog/floating-whatsapp-button
- https://baymard.com/blog/mobile-ux-ecommerce
- https://uxmovement.com/mobile/when-to-use-a-floating-call-to-action-button/
- https://www.chatwoot.com/pricing
- https://www.buildmvpfast.com/blog/chatwoot-vs-crisp-vs-intercom-open-source-customer-support-2026
- https://andypartner.com/blog/alternative-to-tidio-2026
- https://sedeelectronica.sic.gov.co/atencion-y-servicios-a-la-ciudadania/peticiones-quejas-reclamos-y-denuncias
- https://www.sic.gov.co/tema/asuntos-jurisdiccionales/proteccion-al-consumidor
- https://cambiocolombia.com/economia/articulo/2025/6/como-presentar-una-queja-ante-la-superintendencia-de-industria-y-comercio-guia-practica
- https://www.gob.mx/profeco/articulos/proceso-y-requisitos-de-quejas-y-denuncias
- https://concilianet.profeco.gob.mx/Concilianet/inicio.jsp
- https://www.helpscout.com/blog/zendesk-alternatives/
- https://www.getmacha.com/blog/help-desk-software-pricing-compared
- https://www.falabella.com.co/falabella-co/page/centro-de-ayuda
- https://www.falabella.com.co/falabella-co/page/derecho-de-retracto
- https://www.falabella.com.co/falabella-co/page/servicio-al-cliente?staticPageId=13000002
- https://docs.envia.com/docs/envia-shipping-api-introduction
- https://envia.com/en-US/carriers
- https://envia.co/servicios
- https://docs.skydropx.com/
- https://www.skydropx.com.co/
- https://www.skydropx.com/
- https://www.ship24.com/couriers/south-central-america
- https://www.easypost.com/tracking-api/
- https://apps.shopify.com/bulktrack
- https://matrixify.app/tutorials/update-tracking-numbers-for-existing-shopify-orders-in-bulk/
- https://www.webtoffee.com/docs/storerobo/bulk-fulfill-shopify-orders/
