'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Container } from '@/components/layout/Container'
import { useAuthStore } from '@/lib/stores/auth'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

export default function AffiliatesLoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle } = useAuthStore()
  const {
    checkSession: checkAffiliateSession,
    isAuthenticated: affiliateAuthenticated,
    isLoading: affiliateLoading,
  } = useAffiliateAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void checkAffiliateSession()
  }, [checkAffiliateSession])

  useEffect(() => {
    if (!affiliateLoading && affiliateAuthenticated) {
      router.replace('/affiliate/overview')
    }
  }, [affiliateLoading, affiliateAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Completa todos los campos')
      return
    }

    setLoading(true)
    const result = await login(email, password)
    if (!result.success) {
      toast.error(result.error || 'Credenciales incorrectas')
      setLoading(false)
      return
    }

    await checkAffiliateSession()
    if (useAffiliateAuthStore.getState().isAuthenticated) {
      toast.success('Acceso afiliado habilitado')
      router.push('/affiliate/overview')
    } else {
      toast.error('Tu cuenta no tiene acceso al programa de afiliados')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a0a0a] to-[#050505]">
      <Container className="py-12 sm:py-20 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-white/15 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-7"
        >
          <div className="text-center mb-7">
            <img src="/logo.png" alt="nurei" className="w-16 h-16 mx-auto mb-2 object-contain" />
            <h1 className="text-3xl font-black text-primary-dark mt-3">Acceso Afiliados</h1>
            <p className="text-primary-cyan mt-2 text-sm font-medium">Panel de comisiones y ventas</p>
          </div>

          <button
            onClick={() => loginWithGoogle()}
            className="w-full flex items-center justify-center gap-3 py-3 border border-cyan-100 rounded-xl text-sm font-bold text-primary-dark hover:bg-cyan-50 transition-colors mb-5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-cyan-100" />
            <span className="text-xs text-slate-400 font-bold">O con email</span>
            <div className="flex-1 h-px bg-cyan-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 focus:border-primary-cyan transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 focus:border-primary-cyan transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 bg-primary-cyan text-white font-bold rounded-xl shadow-lg shadow-primary-cyan/30 hover:brightness-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar al programa'}
            </motion.button>

            <p className="text-center text-sm text-slate-500">
              ¿Eres cliente?{' '}
              <Link href="/login" className="font-bold text-primary-cyan hover:underline">
                Ir al acceso normal
              </Link>
            </p>
          </form>
        </motion.div>
      </Container>
    </div>
  )
}
