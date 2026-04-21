import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

/** GET ?q= — search brands for autocomplete (debounced on client). */
export async function GET(request: NextRequest) {
  try {
    let supabase
    try {
      supabase = createServiceClient()
    } catch {
      return NextResponse.json({
        data: [] as unknown[],
        warning: 'Falta configuración SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL.',
      })
    }
    const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50
    let query = supabase.from('brands').select('id, name, created_at').order('name', { ascending: true }).limit(limit)
    if (q.length > 0) {
      const esc = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.ilike('name', `%${esc}%`)
    }
    const { data, error } = await query
    if (error) {
      const code = (error as { code?: string }).code
      const msg = (error as { message?: string }).message ?? ''
      // Tabla inexistente o esquema no aplicado — degradar sin tumbar el formulario
      if (
        code === '42P01'
        || code === 'PGRST116'
        || msg.includes('does not exist')
        || msg.includes('schema cache')
      ) {
        return NextResponse.json({
          data: [] as unknown[],
          warning: 'La tabla de marcas no existe aún. Aplica la migración supabase/migrations/010_brands.sql',
        })
      }
      throw error
    }
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

/** POST — create brand (admin). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  try {
    let supabase
    try {
      supabase = createServiceClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Config'
      return NextResponse.json(
        {
          error:
            msg.includes('SUPABASE_SERVICE_ROLE_KEY')
              ? 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: las marcas requieren cliente con rol de servicio.'
              : msg,
        },
        { status: 503 },
      )
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    const name = parsed.data.name.replace(/\s+/g, ' ').trim()
    const { data, error } = await supabase.from('brands').insert({ name }).select('id, name, created_at').single()
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una marca con ese nombre' }, { status: 409 })
      }
      const msg = error.message ?? ''
      if (error.code === '42P01' || msg.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              'La tabla brands no existe. En Supabase SQL Editor ejecuta el contenido de supabase/migrations/010_brands.sql',
          },
          { status: 503 },
        )
      }
      throw error
    }
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error creando marca'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
