import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { resolveAffiliateFirstLast } from '@/lib/server/affiliate-display-name'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const sp = req.nextUrl.searchParams
  const search = sp.get('search')?.toLowerCase().trim() ?? ''
  const statusFilter = sp.get('status') ?? ''
  const hasCoupons = sp.get('has_coupons') ?? ''

  const supabase = createServiceClient()

  // Use * to avoid schema cache errors if migration columns don't exist yet
  const { data: profiles, error } = await supabase
    .from('affiliate_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener afiliados', details: error.message }, { status: 500 })

  const affiliateIds = (profiles ?? []).map((p) => p.id)

  const usersRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const [linksRes, couponsRes, attrsRes] = affiliateIds.length > 0
    ? await Promise.all([
        supabase.from('referral_links').select('affiliate_id, slug, clicks_count').in('affiliate_id', affiliateIds),
        supabase.from('coupons').select('affiliate_id, code, is_active').in('affiliate_id', affiliateIds),
        supabase
          .from('affiliate_attributions')
          .select('affiliate_id, commission_amount_cents')
          .in('affiliate_id', affiliateIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ]

  const slugMap = new Map((linksRes.data ?? []).map((l) => [l.affiliate_id, { slug: l.slug, clicks: l.clicks_count }]))
  const emailMap = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const { data: userProfilesRows } =
    affiliateIds.length > 0
      ? await supabase.from('user_profiles').select('id, full_name').in('id', affiliateIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> }
  const userProfileById = new Map((userProfilesRows ?? []).map((r) => [r.id, r]))

  const { data: customerRows } =
    affiliateIds.length > 0
      ? await supabase
          .from('customers')
          .select('user_id, first_name, last_name, full_name')
          .in('user_id', affiliateIds)
      : { data: [] as Array<{
          user_id: string | null
          first_name: string | null
          last_name: string | null
          full_name: string | null
        }> }
  const customerByUserId = new Map(
    (customerRows ?? []).filter((c) => c.user_id).map((c) => [c.user_id as string, c])
  )

  // coupon count per affiliate
  const couponCountMap = new Map<string, number>()
  for (const c of couponsRes.data ?? []) {
    if (c.affiliate_id) {
      couponCountMap.set(c.affiliate_id, (couponCountMap.get(c.affiliate_id) ?? 0) + 1)
    }
  }

  // total earned + orders per affiliate from attributions
  const attrsMap = new Map<string, { earned: number; orders: number }>()
  for (const a of attrsRes.data ?? []) {
    const cur = attrsMap.get(a.affiliate_id) ?? { earned: 0, orders: 0 }
    attrsMap.set(a.affiliate_id, {
      earned: cur.earned + (a.commission_amount_cents ?? 0),
      orders: cur.orders + 1,
    })
  }

  let enriched = (profiles ?? []).map((p) => {
    const resolved = resolveAffiliateFirstLast(
      p,
      userProfileById.get(p.id) ?? null,
      customerByUserId.get(p.id) ?? null
    )
    return {
      ...p,
      first_name: resolved.first_name || null,
      last_name: resolved.last_name || null,
      email: emailMap.get(p.id) ?? '',
      referral_slug: slugMap.get(p.id)?.slug ?? null,
      clicks_count: slugMap.get(p.id)?.clicks ?? 0,
      coupon_count: couponCountMap.get(p.id) ?? 0,
      total_orders: attrsMap.get(p.id)?.orders ?? 0,
      has_payment_info: Boolean(
        (p as Record<string, unknown>).payment_method ||
          (p as Record<string, unknown>).bank_name ||
          (p as Record<string, unknown>).bank_clabe
      ),
    }
  })

  // Filters
  if (search) {
    enriched = enriched.filter((a) => {
      const displayName = [a.first_name, a.last_name].filter(Boolean).join(' ').toLowerCase()
      return (
        a.handle.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        displayName.includes(search)
      )
    })
  }
  if (statusFilter === 'active') enriched = enriched.filter((a) => a.is_active)
  if (statusFilter === 'inactive') enriched = enriched.filter((a) => !a.is_active)
  if (hasCoupons === 'yes') enriched = enriched.filter((a) => a.coupon_count > 0)
  if (hasCoupons === 'no') enriched = enriched.filter((a) => a.coupon_count === 0)

  return NextResponse.json({ data: enriched })
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()
  const body = await request.json()

  const { email, handle, bio, commission_coupon_pct, commission_cookie_pct, referral_slug, existing_user_id, first_name, last_name } = body

  if (!handle || !referral_slug) {
    return NextResponse.json({ error: 'handle y referral_slug son obligatorios' }, { status: 400 })
  }

  // Pre-validate slug and handle uniqueness
  const [slugCheck, handleCheck] = await Promise.all([
    supabase.from('referral_links').select('id').eq('slug', referral_slug.toLowerCase().trim()).maybeSingle(),
    supabase.from('affiliate_profiles').select('id').eq('handle', handle.trim()).maybeSingle(),
  ])

  if (slugCheck.data) {
    return NextResponse.json({ error: `El slug "${referral_slug}" ya está en uso` }, { status: 409 })
  }
  if (handleCheck.data) {
    return NextResponse.json({ error: `El handle "@${handle}" ya está en uso` }, { status: 409 })
  }

  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''

  // Use targeted lookups instead of paginated listUsers (which caps at 1000)
  const existingUserFromEmail = normalizedEmail
    ? await supabase
        .rpc('get_auth_user_by_email', { p_email: normalizedEmail })
        .then(r => (r.data?.[0] as { id: string; email: string } | undefined) ?? null)
    : null
  if (normalizedEmail && existingUserFromEmail && !existing_user_id) {
    return NextResponse.json(
      { error: 'Este correo ya existe como usuario. Debes seleccionarlo desde "Buscar usuario/cliente".' },
      { status: 409 }
    )
  }

  const existingUserById = existing_user_id
    ? await supabase.auth.admin.getUserById(existing_user_id).then(r => r.data?.user ?? null)
    : null
  if (existing_user_id && !existingUserById) {
    return NextResponse.json(
      { error: 'Usuario seleccionado inválido. Vuelve a buscar y selecciona el usuario/cliente.' },
      { status: 400 }
    )
  }
  const existingUser = existingUserById ?? (existingUserFromEmail
    ? await supabase.auth.admin.getUserById(existingUserFromEmail.id).then(r => r.data?.user ?? null)
    : null)

  let userId: string
  let isNewUser = false
  let originalRole: string | null = null
  const affiliateLoginRedirect = `${resolvePublicUrl()}/affiliates/login`

  if (existingUser) {
    const { data: roleProfile, error: roleError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', existingUser.id)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: 'No se pudo validar el rol del usuario' }, { status: 500 })
    }
    if (roleProfile?.role === 'admin') {
      return NextResponse.json(
        { error: 'No se puede convertir un usuario administrador en afiliado.' },
        { status: 409 }
      )
    }

    const { data: existingProfile } = await supabase
      .from('affiliate_profiles')
      .select('id, handle')
      .eq('id', existingUser.id)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: `Este usuario ya es afiliado con handle @${existingProfile.handle}` },
        { status: 409 }
      )
    }

    userId = existingUser.id
    originalRole = roleProfile?.role ?? null
  } else {
    if (!email) {
      return NextResponse.json({ error: 'Debes seleccionar un usuario existente o proporcionar email' }, { status: 400 })
    }
    // Generate a random throwaway password — an invite email is sent immediately after
    const randomPassword = require('crypto').randomBytes(24).toString('hex')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false,
      password: randomPassword,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 400 })
    }

    userId = authData.user.id
    isNewUser = true
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (currentProfileError) {
    if (isNewUser) await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Error al validar perfil del usuario' }, { status: 500 })
  }
  if (currentProfile?.role === 'admin') {
    if (isNewUser) await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'No se puede convertir un usuario administrador en afiliado.' },
      { status: 409 }
    )
  }

  const profileUpdate = { role: 'affiliate' }
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .update(profileUpdate)
    .eq('id', userId)

  if (profileErr) {
    if (isNewUser) await supabase.auth.admin.deleteUser(userId)
    else if (originalRole) await supabase.from('user_profiles').update({ role: originalRole }).eq('id', userId)
    return NextResponse.json({ error: 'Error al asignar rol de afiliado' }, { status: 500 })
  }

  const { error: affiliateErr } = await supabase.from('affiliate_profiles').insert({
    id: userId,
    handle: handle.trim(),
    bio: bio?.trim() ?? null,
    first_name: first_name?.trim() ?? null,
    last_name: last_name?.trim() ?? null,
    commission_coupon_pct: commission_coupon_pct ?? 10,
    commission_cookie_pct: commission_cookie_pct ?? 5,
  })

  if (affiliateErr) {
    if (isNewUser) await supabase.auth.admin.deleteUser(userId)
    else if (originalRole) await supabase.from('user_profiles').update({ role: originalRole }).eq('id', userId)
    return NextResponse.json(
      { error: affiliateErr.message.includes('unique') ? 'El handle ya está en uso' : affiliateErr.message },
      { status: 500 }
    )
  }

  const { error: linkError } = await supabase.from('referral_links').insert({
    affiliate_id: userId,
    slug: referral_slug.toLowerCase().trim(),
  })

  if (linkError) {
    if (isNewUser) await supabase.auth.admin.deleteUser(userId)
    else {
      await supabase.from('affiliate_profiles').delete().eq('id', userId)
      await supabase.from('user_profiles').update({ role: originalRole ?? 'customer' }).eq('id', userId)
    }
    return NextResponse.json({ error: 'Error al crear link de referido' }, { status: 500 })
  }

  const affiliateEmail = existingUser?.email?.toLowerCase?.() ?? normalizedEmail
  if (affiliateEmail) {
    const inviteRes = await supabase.auth.admin.inviteUserByEmail(affiliateEmail, { redirectTo: affiliateLoginRedirect })
    if (inviteRes.error) {
      const resetRes = await supabase.auth.resetPasswordForEmail(affiliateEmail, { redirectTo: affiliateLoginRedirect })
      if (resetRes.error) {
        return NextResponse.json({
          ok: true, userId, isUpgrade: !isNewUser,
          warning: `Afiliado creado, pero no se pudo enviar correo de activación: ${resetRes.error.message}`,
        }, { status: 201 })
      }
    }
  }

  return NextResponse.json({ ok: true, userId, isUpgrade: !isNewUser }, { status: 201 })
}
