import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPaymentMethods, updatePaymentMethod, togglePaymentMethod } from '@/lib/supabase/queries/paymentMethods'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const methods = await getPaymentMethods(supabase, activeOnly)
    return NextResponse.json({ data: methods })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching payment methods' })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Toggle active
    if (body.is_active !== undefined && Object.keys(body).length === 2) {
      await togglePaymentMethod(supabase, body.id, body.is_active)
      return NextResponse.json({ success: true })
    }

    const { id, ...updates } = body
    const method = await updatePaymentMethod(supabase, id, updates)
    return NextResponse.json({ data: method })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating payment method'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
