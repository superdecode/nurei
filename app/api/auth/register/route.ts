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
  name: z.string().min(2, 'Nombre demasiado corto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
})

export async function POST(request: NextRequest) {
  const pendingCookies: CookieToSet[] = []

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const { name, email, password } = parsed.data

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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    if (error) {
      const msg =
        error.message.includes('already registered')
          ? 'Este email ya está registrado'
          : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }

    const res = NextResponse.json({
      data: {
        user_id: data.user?.id,
        email: data.user?.email,
        name,
        session: !!data.session,
      },
    })
    return applyAuthCookies(res, pendingCookies)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
