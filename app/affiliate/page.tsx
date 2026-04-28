'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DollarSign, MousePointer2, Wallet, ShoppingBag, BarChart2, TrendingUp, Settings } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

import AffiliateOverview from './AffiliateOverview'
import AffiliateStats from './AffiliateStats'
import AffiliateProfileTab from './AffiliateProfileTab'

export default function AffiliatePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'profile'>('overview')
  const { user } = useAffiliateAuthStore()

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: TrendingUp },
    { id: 'stats', label: 'Estadísticas', icon: BarChart2 },
    { id: 'profile', label: 'Perfil', icon: Settings },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-cyan to-primary-dark flex items-center justify-center text-white font-black text-lg">
              {user?.handle?.slice(0, 1).toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-black text-primary-dark">
                Panel de Afiliados
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Gestiona tu información, estadísticas y pagos
              </p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 bg-white rounded-t-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  relative px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-dark text-primary-dark'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden min-h-[calc(100vh-200px)]">
          {activeTab === 'overview' && <AffiliateOverview />}
          {activeTab === 'stats' && <AffiliateStats />}
          {activeTab === 'profile' && <AffiliateProfileTab />}
        </div>
      </div>
    </div>
  )
}
