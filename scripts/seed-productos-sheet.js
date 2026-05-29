/* eslint-disable */
// Script para insertar productos desde el Google Sheet organizado por el usuario
// Ejecutar: node scripts/seed-productos-sheet.js

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars before running this script.')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

const MK_ID = '90a08fd2-8f41-4d60-87fa-e4daf0194c1a' // Master Kong brand_id

// ─── Descripciones ──────────────────────────────────────────────────────────

const DESC_BULDAK_POLLO = `El pilar de la marca coreana y el sabor clásico con el que empezó todo. Fideos salteados con el picante normal y tradicional de la línea Samyang: el balance perfecto para quienes buscan el verdadero toque coreano con un picor presente y disfrutable, sin llegar a los niveles extremos de otras versiones.

¿A qué sabe y qué tanto pica? 👅
Nivel de Picor: 🌶️🌶️🌶️🌶️ Picante Regular / Medio-Alto. Un picor constante que se siente desde el primer bocado, pero que te permite seguir disfrutando el plato de principio a fin.
Perfil de Sabor: 🍗 Sumamente sabroso. Base muy rica de pollo sazonado con un sutil toque dulce y notas ahumadas. El balance entre lo salado, el dulzor y el picante es lo que lo hace tan adictivo.
Textura de los Fideos: 🥢 De trigo, notablemente más gruesos, firmes y masticables que los de un ramen común, ideales para que la salsa se adhiera por completo.

¿Cómo se prepara correctamente? (Estilo Salteado) 💡
Este no es un ramen con caldo. Se hierven los fideos, se drena casi toda el agua (dejando unas 8 cucharadas) y luego se agrega la salsa roja para saltearlos en la sartén a fuego bajo por 30 segundos.`

const DESC_BULDAK_QUESO = `La fusión perfecta entre el toque picante coreano y la cremosidad del queso. Esta versión toma la base clásica del fideo salteado Buldak y le añade un polvo de queso especial que se funde con la salsa roja, creando una consistencia cremosa que envuelve cada fideo y suaviza el golpe del picor.

¿A qué sabe y qué tanto pica? 👅
Perfil de Sabor: 🧀 Un acierto total. Combina el clásico sazón de pollo picante con las notas lácteas, saladas y reconfortantes del queso fundido. El resultado sabe a unos macarrones con queso premium con un giro asiático especiado.
Nivel de Picor: 🌶️🌶️🌶️ Moderado / Medio. Gracias al queso, es notablemente menos agresivo que el sabor original. Los lácteos ayudan a neutralizar el ardor, haciendo la experiencia más tersa y amigable.
Textura: ☁️ Extra cremosa y densa. Al mezclar la salsa con el polvo de queso, se crea una textura cremosa y sedosa que se adhiere por completo a los fideos gruesos de trigo.

¿Qué incluye y cómo se prepara? 💡
Doble sobre de sazón: incluye la icónica salsa roja picante más un sobre con polvo de queso deshidratado y algas.
Preparación al sartén: Se hierven los fideos por 5 minutos, se drena casi toda el agua (deja unas cucharadas para ligar la salsa), se vierte la salsa líquida junto con el polvo de queso y se saltea a fuego bajo por 30 segundos hasta que espese.
Tip Pro: 🍳 Para llevar la cremosidad al siguiente nivel, añade una rebanada de queso tipo americano o un chorrito de leche entera mientras lo salteas.`

const DESC_BULDAK_CARBONARA = `El fenómeno mundial de las redes sociales. Esta versión reinventa el ramen coreano al fusionar la icónica salsa picante Buldak con un polvo cremoso de queso, leche y un toque de tocino que imita la clásica salsa carbonara. Es la opción más suave, cremosa y adictiva de la marca.

¿A qué sabe y qué tanto pica? 👅
Perfil de Sabor: 🧀🥓 Una delicia absoluta. Notas ricas de queso, crema y un fondo ligeramente ahumado que recuerda al tocino. Al mezclarse con el toque de pollo picante, se convierte en una salsa cremosa de alta cocina urbana.
Nivel de Picor: 🌶️🌶️ Bajo / Moderado (El más amigable de la línea). La densa base láctea arropa las papilas gustativas, reduciendo el ardor al mínimo y haciéndolo apto para casi cualquier paladar.
Textura: ☁️ Terciopelada y espesa. Los fideos gruesos quedan bañados en una salsa suave y sedosa, idéntica a una pasta recién servida.

¿Qué incluye y cómo se prepara? 💡
Doble sobre de sazón: la bolsita con la salsa líquida picante original más el sobre grande con el polvo de queso, crema y especias carbonara.
Preparación: Hierve los fideos 5 minutos. Al escurrir, deja unas 6 a 8 cucharadas del líquido de cocción (vital para que el polvo no se haga grumos). Agrega ambos sobres y revuelve enérgicamente a fuego muy bajo por 30 segundos hasta lograr una crema homogénea.`

const DESC_BULDAK_2X = `El reto definitivo. Si el sabor original ya imponía respeto, esta versión duplica la dosis de extracto de chile concentrado para ofrecer una experiencia de fuego puro. Diseñado exclusivamente para valientes, competidores y verdaderos fanáticos del picor extremo.

¿A qué sabe y qué tanto pica? 👅
Nivel de Picor: 🌶️🌶️🌶️🌶️🌶️ Extremo / Masoquista. Un picor agresivo que golpea con fuerza desde el segundo uno. Provoca calor intenso e inmediato en los labios, la lengua y la garganta, acompañado de sudoración instantánea. El efecto dura bastantes minutos.
Perfil de Sabor: 🍗 Debajo de la marea de fuego sigue estando el adictivo sazón de pollo Buldak, con su característico toque sutilmente dulce y ahumado. Sin embargo, el dulzor es apenas un destello antes de que el picor tome el control absoluto.
Textura: 🥢 Fideos de trigo gruesos, firmes y muy elásticos, completamente pintados de un rojo oscuro y denso que advierte su peligrosidad.

¿Cómo se prepara? 💡
Hierve los fideos por 5 minutos y escúrrelos dejando unas 8 cucharadas de agua. Agrega la salsa roja y saltea a fuego bajo por 30 segundos para que el picor se concentre y se adhiera a cada fideo.
Kit de Emergencia: 🥛 No intentes calmar este picor con agua; solo esparcirá el aceite de chile. Ten a la mano leche fría, helado o una bebida láctea dulce para cortar el efecto de la capsaicina.`

const DESC_MK_RES_VASO = `El sabor más famoso de la marca, ahora en un vaso súper práctico para preparar donde sea. No necesitas olla, estufa ni sartén; solo agua caliente y en pocos minutos tienes una comida calientita y llenadora. Perfectos para la oficina, la escuela, el camino o ese antojo nocturno cuando no quieres cocinar.

Perfil de sabor: 🥩
Un clásico que nunca falla. El caldo tiene un sabor intenso a carne de res cocinada lentamente, con un toque de salsa de soya y especias chinas que le dan ese aroma casero tan característico. Es espesito, reconfortante y muy sabroso.
Nivel de picante: Sin picante. Tiene un toque especiado muy suave, ideal si prefieres sabores ricos sin enchilarte.
Textura de los fideos: 🥢 Suaves y elásticos, absorben muy bien el caldo y no se baten. Hechos para prepararse directo en el vaso con buena textura.

¿Cómo prepararlos? 💡
El mismo vaso funciona como recipiente e incluye tenedor. Dentro vienen los sobres de sopa, vegetales y la pasta de grasa de res.

Preparación rápida 🕒
1. Abre la tapa a la mitad y agrega todos los sobres.
2. Llena el vaso con agua hirviendo hasta la línea marcada.
3. Tapa, espera 3 a 4 minutos, revuelve bien y listo.`

const DESC_MK_RES_PICANTE_VASO = `Olvídate de prender la estufa o andar lavando trastes; este bowl es la salvación perfecta para armarte una comida caliente, picosita y llenadora en la oficina, la escuela o cuando andas en la calle con el tiempo encima.

¿A qué sabe y qué tanto pica? 👅
Perfil de Sabor: 🥩 Un caldito de res muy concentrado y sustancioso, sazonado con salsa de soya y especias chinas, con el ingrediente estrella: aceite de chile tostado que le da un aroma delicioso desde que le echas el agua.
Nivel de Picor: 🌶️🌶️🌶️ Picante Sabroso / Medio. Para el paladar mexicano no es un picor que haga llorar, sino ese picantito rico que calienta la garganta, da sabor y te hace disfrutar cada bocado.
Textura de los Fideos: 🥢 De trigo, se cocinan a la perfección dentro del mismo vaso, quedando suaves pero firmes.

Para comerse donde sea (Solo agrégale agua caliente) 💡
Es su propio plato térmico e incluye tenedor. Viene con sobre de caldo en polvo, verduras deshidratadas y la pasta de aceite de chile que le da todo el color y sazón.

Se prepara en tres pasos: 🕒
1. Abre la tapa hasta la mitad y vacía todos los sobrecitos sobre los fideos.
2. Echa agua hirviendo hasta la línea de adentro.
3. Tapa, espera 3 minutos, revuelve bien y a entrarle.`

const DESC_MK_SUAN_CAI = `Uno de los ramens más vendidos y adictivos de toda Asia. Su secreto está en la combinación del caldo de res con el Suan Cai (mostaza verde encurtida en pozos tradicionales). El resultado es un caldo con un contraste increíble entre lo salado de la carne, lo picosito de las especias y un toque ácido que corta la grasa a la perfección.

¿A qué sabe y qué tanto pica? 👅
Perfil de Sabor: 🥩🥬 Una joya para el paladar. Sabe a un caldito de res reconfortante con un giro cítrico y avinagrado gracias al encurtido. Si te gusta el limón y la salsa en caldos de res o pozole, este sabor te va a volver loco.
Nivel de Picor: 🌶️🌶️🌶️ Medio. Sazonado con rodajas de chile rojo deshidratado. No te hará llorar, pero tiene ese calorcito sabroso que levanta el caldito y hace sudar rico.
Textura: 🥢 Los fideos de trigo absorben la acidez del caldo, y los trozos de verdura encurtida le añaden un texturizado ligeramente crujiente en cada bocado.

¿Qué lo hace especial y cómo se prepara? 💡
Incluye un paquete húmedo con la verdura encurtida real (Lao Tan Suan Cai). No son polvos; son las hojas picadas listas para darle toda la frescura al plato.
Preparación en olla: 🕒 Hierve dos tazas de agua. Agrega los fideos, el sobre de caldo en polvo, la pasta sazonadora y el sobre de verduras encurtidas. Cocina a fuego medio 3 minutos y sirve bien caliente.
Tip Pro: 🍳 Queda espectacular si le agregas unas rebanadas delgadas de carne de res fresca o cebollín picado justo al apagar el fuego.`

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Crear marca Buldak si no existe
  let buldakId
  const { data: existingBuldak } = await client
    .from('brands')
    .select('id')
    .eq('name', 'Buldak')
    .maybeSingle()

  if (existingBuldak) {
    buldakId = existingBuldak.id
    console.log('Marca Buldak ya existe:', buldakId)
  } else {
    const { data: newBrand, error: brandErr } = await client
      .from('brands')
      .insert({ name: 'Buldak' })
      .select()
      .single()
    if (brandErr) {
      console.error('Error creando marca Buldak:', brandErr.message)
      return
    }
    buldakId = newBrand.id
    console.log('Marca Buldak creada:', buldakId)
  }

  // 2. Definir productos
  const products = [
    {
      name: 'Fideos Instantáneos Sabor a Pollo Picante – Buldak',
      slug: 'fideos-instantaneos-pollo-picante-buldak-140gr',
      sku: 'BULDAK-POLLO-140',
      description: DESC_BULDAK_POLLO,
      category: 'ramen',
      brand: 'Buldak',
      brand_id: buldakId,
      origin: 'Corea del Sur',
      origin_country: 'Corea del Sur',
      unit_of_measure: 'units',
      weight_g: 140,
      base_price: 50,
      price: 50,
      cost_estimate: 26,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 4,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'buldak', 'picante', 'coreano', 'fideos', 'salteado'],
    },
    {
      name: 'Fideos Instantáneos Sabor a Queso Picante – Buldak',
      slug: 'fideos-instantaneos-queso-picante-buldak-140gr',
      sku: 'BULDAK-QUESO-140',
      description: DESC_BULDAK_QUESO,
      category: 'ramen',
      brand: 'Buldak',
      brand_id: buldakId,
      origin: 'Corea del Sur',
      origin_country: 'Corea del Sur',
      unit_of_measure: 'units',
      weight_g: 140,
      base_price: 50,
      price: 50,
      cost_estimate: 26,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 3,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'buldak', 'queso', 'picante', 'coreano', 'cheese'],
    },
    {
      name: 'Fideos Instantáneos Sabor a Carbonara Picante – Buldak',
      slug: 'fideos-instantaneos-carbonara-picante-buldak-140gr',
      sku: 'BULDAK-CARBONARA-140',
      description: DESC_BULDAK_CARBONARA,
      category: 'ramen',
      brand: 'Buldak',
      brand_id: buldakId,
      origin: 'Corea del Sur',
      origin_country: 'Corea del Sur',
      unit_of_measure: 'units',
      weight_g: 140,
      base_price: 50,
      price: 50,
      cost_estimate: 26,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 2,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'buldak', 'carbonara', 'cremoso', 'coreano'],
    },
    {
      name: 'Fideos Instantáneos Doble Picante 2X Spicy – Buldak',
      slug: 'fideos-instantaneos-2x-spicy-buldak-140gr',
      sku: 'BULDAK-2XSPICY-140',
      description: DESC_BULDAK_2X,
      category: 'ramen',
      brand: 'Buldak',
      brand_id: buldakId,
      origin: 'Corea del Sur',
      origin_country: 'Corea del Sur',
      unit_of_measure: 'units',
      weight_g: 140,
      base_price: 50,
      price: 50,
      cost_estimate: 26,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 5,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'buldak', 'picante', 'extremo', '2x', 'reto', 'coreano'],
    },
    {
      name: 'Fideos de Res Práctico – Vaso Sin Estufa – Master Kong',
      slug: 'fideos-res-practico-vaso-master-kong-113gr',
      sku: 'MK-RES-VASO-113',
      description: DESC_MK_RES_VASO,
      category: 'ramen',
      brand: 'Master Kong',
      brand_id: MK_ID,
      origin: 'China',
      origin_country: 'China',
      unit_of_measure: 'units',
      weight_g: 113,
      base_price: 45,
      price: 45,
      cost_estimate: 20,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 0,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'master kong', 'res', 'chino', 'vaso', 'practico', 'sin estufa'],
    },
    {
      name: 'Fideos de Res Picantes – Vaso Sin Estufa – Master Kong',
      slug: 'fideos-res-picantes-vaso-master-kong-113gr',
      sku: 'MK-RES-PICANTE-VASO-113',
      description: DESC_MK_RES_PICANTE_VASO,
      category: 'ramen',
      brand: 'Master Kong',
      brand_id: MK_ID,
      origin: 'China',
      origin_country: 'China',
      unit_of_measure: 'units',
      weight_g: 113,
      base_price: 45,
      price: 45,
      cost_estimate: 20,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 3,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'master kong', 'res', 'chino', 'vaso', 'picante', 'sin estufa'],
    },
    {
      name: 'Ramen de Res con Verdura Encurtida (Suan Cai) – Master Kong',
      slug: 'ramen-res-verdura-encurtida-suan-cai-master-kong-103gr',
      sku: 'MK-SUAN-CAI-103',
      description: DESC_MK_SUAN_CAI,
      category: 'ramen',
      brand: 'Master Kong',
      brand_id: MK_ID,
      origin: 'China',
      origin_country: 'China',
      unit_of_measure: 'units',
      weight_g: 103,
      base_price: 35,
      price: 35,
      cost_estimate: 11,
      stock_quantity: 20,
      low_stock_threshold: 5,
      track_inventory: true,
      allow_backorder: false,
      spice_level: 3,
      requires_spice_level: false,
      has_variants: false,
      is_featured: false,
      is_limited: false,
      is_active: true,
      status: 'active',
      availability_score: 100,
      images: [],
      primary_image_index: 0,
      tags: ['ramen', 'master kong', 'res', 'chino', 'encurtido', 'suan cai', 'acido'],
    },
  ]

  // 3. Insertar productos (skip duplicados por SKU)
  console.log('\n─── Insertando productos ───────────────────────────────')
  let created = 0
  let skipped = 0

  for (const product of products) {
    const { data: existing } = await client
      .from('products')
      .select('id')
      .eq('sku', product.sku)
      .maybeSingle()

    if (existing) {
      console.log(`SKIP  [ya existe] ${product.name}`)
      skipped++
      continue
    }

    const { data, error } = await client
      .from('products')
      .insert(product)
      .select('id, name, base_price, spice_level, sku')
      .single()

    if (error) {
      console.error(`ERROR [${product.sku}]`, error.message)
    } else {
      console.log(`OK    [${data.sku}] ${data.name} | $${data.base_price} | picante: ${data.spice_level}`)
      created++
    }
  }

  console.log(`\n─── Resultado: ${created} creados, ${skipped} omitidos ───`)

  // 4. Listar todos los productos de ramen activos
  console.log('\n─── Productos ramen en DB ──────────────────────────────')
  const { data: allRamen } = await client
    .from('products')
    .select('name, sku, base_price, spice_level, brand, status')
    .eq('category', 'ramen')
    .eq('status', 'active')
    .order('brand')
    .order('name')

  allRamen?.forEach(p => {
    const spice = p.spice_level > 0 ? `🌶️×${p.spice_level}` : 'sin picante'
    console.log(`  [${p.sku}] ${p.name} | $${p.base_price} | ${spice}`)
  })
  console.log(`\nTotal ramen activos: ${allRamen?.length ?? 0}`)
}

main().catch(console.error)
