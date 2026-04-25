'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores/auth'
import { Container } from '@/components/layout/Container'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get('redirect') ?? '/perfil'
  const redirectTo =
    requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/perfil'
  const { login, loginWithGoogle, checkSession, isAuthenticated, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo)
    }
  }, [isAuthenticated, isLoading, redirectTo, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Completa todos los campos'); return }
    setLoading(true)
    const result = await login(email, password)
    if (result.success) {
      toast.success('Bienvenido de vuelta', { icon: '👋' })
      router.push(redirectTo)
    } else {
      toast.error(result.error || 'Credenciales incorrectas')
    }
    setLoading(false)
  }

  return (
    <Container className="py-12 sm:py-20 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/logo.png" alt="nurei" className="w-16 h-16 mx-auto mb-2 object-contain" />
          <h1 className="text-3xl font-black text-gray-900 mt-3">Iniciar sesión</h1>
          <p className="text-gray-500 mt-2 text-sm">Accede a tu cuenta nurei</p>
        </div>

        {/* Google */}
        <GoogleAuthButton onClick={() => loginWithGoogle()} className="mb-5 w-full flex items-center justify-center gap-3 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors" />

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-bold">O con email</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-nurei-cta text-gray-900 font-bold rounded-xl shadow-lg shadow-nurei-cta/25 hover:shadow-xl transition-all disabled:opacity-50">
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </motion.button>

          <p className="text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-bold text-nurei-cta hover:underline">Regístrate</Link>
          </p>
          <p className="text-center mt-6">
            <Link
              href="/affiliates/login"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Acceso programa de afiliados →
            </Link>
          </p>
          <p className="text-center text-xs text-gray-500">
            <button
              type="button"
              className="font-semibold text-primary-dark hover:underline"
              onClick={async () => {
                if (!email.trim()) {
                  toast.error('Escribe tu email para recuperar contraseña')
                  return
                }
                setResetting(true)
                const res = await fetch('/api/auth/forgot-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: email.trim() }),
                })
                const json = await res.json()
                if (!res.ok) toast.error(json.error ?? 'No se pudo enviar el correo')
                else toast.success('Te enviamos un correo para recuperar contraseña')
                setResetting(false)
              }}
              disabled={resetting}
            >
              {resetting ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
            </button>
          </p>
        </form>
      </motion.div>
    </Container>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
