import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }

function applyAuthCookies(res: NextResponse, pending: CookieToSet[]) {
  for (const { name, value, options } of pending) {
    if (value === '') {
      res.cookies.delete(name)
    } else {
      res.cookies.set(name, value, options)
    }
  }
  return res
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const pendingCookies: CookieToSet[] = []

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet)
          },
        },
      },
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      const msg =
        error.message.includes('Invalid login credentials')
          ? 'Email o contraseña incorrectos'
          : error.message
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const res = NextResponse.json({
      data: {
        user: profile ?? {
          id: data.user.id,
          full_name: null,
          phone: null,
          avatar_url: null,
          role: 'customer' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    })
    return applyAuthCookies(res, pendingCookies)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
