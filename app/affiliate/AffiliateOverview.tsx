'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, ExternalLink, Copy, Check, ArrowRight, DollarSign, Wallet, BarChart2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import Link from 'next/link'
import { toast } from 'sonner'

interface StatsData {
  total_earned_cents: number
  pending_payout_cents: number
  total_orders: number
  total_clicks: number
  conversion_rate: number
  weekly_sales?: Array<{ week: string; amount_cents: number; orders: number }>
  top_products?: Array<{ product_name: string; units: number }>
}

export default function AffiliateOverview() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [profile, setProfile] = useState<{ referral_slug: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || (typeof window !== 'undefined' ? window.location.origin.trim() : '')

  useEffect(() => {
    Promise.all([
      fetch('/api/affiliate/stats').then(r => r.json()),
      fetch('/api/affiliate/profile').then(r => r.json()),
    ]).then(([{ data: statsData }, { data: profileData }]) => {
      setStats(statsData)
      setProfile(profileData)
      setLoading(false)
    })
  }, [])

  const referralUrl = profile?.referral_slug?.trim() ? `${siteUrl}/r/${profile.referral_slug.trim()}` : null

  const copyLink = () => {
    if (!referralUrl) return
    void navigator.clipboard.writeText(referralUrl)
    toast.success('Link copiado al portapapeles')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-xl" />
      <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />
        <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    </div>
  )

  if (!stats) {
    return <div className="flex flex-col items-center justify-center py-12">
      <p className="text-sm text-gray-400">Error al cargar estadísticas</p>
    </div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-emerald-900 mb-1">Ganancias totales</h2>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <p className="text-sm text-emerald-700 mb-1">Total ganado</p>
                <p className="text-3xl font-black text-emerald-900">{formatPrice(stats.total_earned_cents)}</p>
              </div>
              <div>
                <p className="text-sm text-emerald-700 mb-1">Por cobrar</p>
                <p className="text-3xl font-black text-emerald-900">{formatPrice(stats.pending_payout_cents)}</p>
              </div>
            </div>
          </div>
          <div className="text-emerald-600">
            <DollarSign className="w-12 h-12" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pedidos</p>
              <BarChart2 className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-black text-primary-dark">{stats.total_orders}</p>
            <p className="text-xs text-gray-400">Total referidos</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Clics</p>
              <MousePointer2 className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-black text-primary-dark">{stats.total_clicks.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Clics totales</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Conversión</p>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-black text-primary-dark">{stats.conversion_rate}%</p>
            <p className="text-xs text-gray-400">Clics → compra</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ganancia semanal</p>
              <Wallet className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-primary-cyan" />
              <Link
                href="/affiliate/ventas"
                className="text-sm font-semibold text-primary-dark hover:underline"
              >
                Ver ventas
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Tu link de referido</h3>
          {profile?.referral_slug?.trim() && referralUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
                <span className="text-xs font-mono text-primary-dark flex-1 truncate">{referralUrl}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary-dark text-white text-sm font-bold hover:bg-primary-dark/90 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </button>
                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> {stats.total_clicks} clics totales · {stats.conversion_rate}% conversión
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <p className="text-sm text-gray-400">Tu link de referido aún no está configurado.</p>
              <p className="text-xs text-gray-500">Contacta al administrador para activarlo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
