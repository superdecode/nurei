'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores/auth'
import { Container } from '@/components/layout/Container'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

export default function RegistroPage() {
  const router = useRouter()
  const { register, loginWithGoogle } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) { toast.error('Completa todos los campos'); return }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    const result = await register(name, email, password)
    if (result.success) {
      toast.success('¡Cuenta creada!', { description: 'Revisa tu email para confirmar tu cuenta.', icon: '🎉' })
      router.push('/perfil')
    } else {
      toast.error(result.error || 'Error al crear la cuenta')
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
          <h1 className="text-3xl font-black text-gray-900 mt-3">Crear cuenta</h1>
          <p className="text-gray-500 mt-2 text-sm">Únete a la comunidad nurei</p>
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
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Nombre</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre" autoFocus
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-nurei-cta text-gray-900 font-bold rounded-xl shadow-lg shadow-nurei-cta/25 hover:shadow-xl transition-all disabled:opacity-50">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </motion.button>

          <p className="text-center text-xs text-gray-400">
            Al registrarte aceptas nuestros{' '}
            <Link href="/legal/terminos" className="underline font-medium text-nurei-cta">Términos de servicio</Link>
            {' '}y{' '}
            <Link href="/legal/privacidad" className="underline font-medium text-nurei-cta">Política de privacidad</Link>
          </p>

          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-bold text-nurei-cta hover:underline">Inicia sesión</Link>
          </p>
        </form>
      </motion.div>
    </Container>
  )
}
