import { NextRequest, NextResponse } from 'next/server'
import { PRODUCTS } from '@/lib/data/products'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')
  const featured = searchParams.get('featured')

  let products = PRODUCTS.filter((p) => p.is_active)

  if (category && category !== 'all') {
    products = products.filter((p) => p.category === category)
  }

  if (featured === 'true') {
    products = products.filter((p) => p.is_featured)
  }

  // Sort: featured first, then by availability, then name
  products.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
    if (a.availability_score !== b.availability_score) return b.availability_score - a.availability_score
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({
    data: { products, total: products.length },
  })

  // TODO: Replace with Supabase query
  // const supabase = createServiceClient()
  // const query = supabase.from('products').select('*').eq('is_active', true)
  // if (category) query.eq('category', category)
  // if (featured) query.eq('is_featured', true)
  // const { data, error } = await query.order('is_featured', { ascending: false })
}
