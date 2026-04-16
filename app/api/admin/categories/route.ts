import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '@/lib/supabase/queries/categories'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const categories = await listCategories(supabase)
    return NextResponse.json({ data: categories })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const category = await createCategory(supabase, body)
    return NextResponse.json({ data: category })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    
    if (body.reorder) {
      await reorderCategories(supabase, body.orders)
      return NextResponse.json({ message: 'Reordered' })
    }

    const { id, ...data } = body
    const category = await updateCategory(supabase, id, data)
    return NextResponse.json({ data: category })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) throw new Error('ID is required')
    
    await deleteCategory(supabase, id)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
