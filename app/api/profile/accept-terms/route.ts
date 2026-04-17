import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

export async function POST(request: NextRequest) {
  const pendingCookies: CookieToSet[] = []

  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        legal_terms_accepted_at: new Date().toISOString(),
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const res = NextResponse.json({ data: { success: true } })
    return applyAuthCookies(res, pendingCookies)
  } catch {
    return NextResponse.json({ error: 'Error al registrar aceptación' }, { status: 500 })
  }
}
