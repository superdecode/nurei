import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserCoupons } from '@/lib/supabase/queries/userCoupons'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const coupons = await getUserCoupons(supabase, user.id)
    return NextResponse.json({ data: coupons })
  } catch {
    return NextResponse.json({ error: 'Error al obtener cupones' }, { status: 500 })
  }
}
