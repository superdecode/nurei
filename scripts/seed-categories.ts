import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const INITIAL_CATEGORIES = [
  { name: 'Ramen', slug: 'ramen', emoji: '🍜', color: '#F59E0B', description: 'Ramen instantáneo y fresco de diversas regiones', is_active: true, sort_order: 0 },
  { name: 'Dumplings', slug: 'dumplings', emoji: '🥟', color: '#00E5FF', description: 'Gyoza, shumai, bao y otras empanadillas asiáticas', is_active: true, sort_order: 1 },
  { name: 'Snacks Crunchy', slug: 'snacks-crunchy', emoji: '🍘', color: '#8B5CF6', description: 'Snacks crujientes de arroz, algas y maíz', is_active: true, sort_order: 2 },
  { name: 'Salsa & Condimentos', slug: 'salsas-condimentos', emoji: '🌶️', color: '#EF4444', description: 'Salsas, pastas y aderezos asiáticos', is_active: true, sort_order: 3 },
  { name: 'Bebidas', slug: 'bebidas', emoji: '🧋', color: '#0A1F2F', description: 'Bubble tea, matcha, té de cebada y más', is_active: true, sort_order: 4 },
  { name: 'Dulces & Postres', slug: 'dulces-postres', emoji: '🍡', color: '#DC2626', description: 'Mochi, pocky, daifuku y dulces asiáticos', is_active: true, sort_order: 5 },
  { name: 'Edición Limitada', slug: 'edicion-limitada', emoji: '⭐', color: '#10B981', description: 'Productos de temporada y colaboraciones especiales', is_active: false, sort_order: 6 },
  { name: 'Otros', slug: 'otros', emoji: '🛒', color: '#6B7280', description: 'Utensilios, accesorios y artículos de cocina asiática', is_active: false, sort_order: 7 },
]

async function seed() {
  console.log('Seeding categories...')
  const { data, error } = await supabase.from('categories').insert(INITIAL_CATEGORIES)
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Categories seeded successfully!')
  }
}

seed()
