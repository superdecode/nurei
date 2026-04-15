'use client'

import { motion } from 'framer-motion'
import { Container } from '@/components/layout/Container'
import { PageTransition } from '@/components/motion'
import { Sparkles, Heart, Globe, Truck, ShieldCheck, Star } from 'lucide-react'

const STATS = [
  { label: 'Productos importados', value: '+500', icon: Globe },
  { label: 'Clientes felices', value: '+2,000', icon: Heart },
  { label: 'Envío promedio', value: '45 min', icon: Truck },
]

export default function NosotrosPage() {
  return (
    <PageTransition>
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-yellow-50/50 rounded-full blur-[120px] -z-10" />
        
        <Container>
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-nurei-cta/10 text-nurei-cta rounded-full text-xs font-bold uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Nuestra Historia
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1]"
            >
              Traemos lo mejor de <span className="text-nurei-cta">Asia</span> a tu puerta.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-gray-500 font-medium leading-relaxed"
            >
              En Nurei, creemos que los snacks no son solo comida; son experiencias, cultura y momentos de alegría. 
              Nuestra misión es conectar a México con la vibrante y deliciosa cultura de los snacks asiáticos.
            </motion.p>
          </div>
        </Container>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {STATS.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col items-center text-center space-y-3"
              >
                <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center text-nurei-cta">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-3xl font-black text-gray-900">{stat.value}</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-tighter">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gray-50/50">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-12"
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-gray-900">¿Por qué Nurei?</h2>
                <div className="w-20 h-1.5 bg-nurei-cta rounded-full" />
              </div>

              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-nurei-cta">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900">Calidad Grantizada</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Cada producto en nuestro catálogo ha sido cuidadosamente seleccionado y probado. 
                      Solo traemos lo que nosotros mismos amaríamos comer.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-nurei-cta">
                    <Star className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900">Curaduría Exclusiva</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Trabajamos directamente con proveedores en Japón, Corea y China para tener lanzamientos exclusivos
                      y ediciones limitadas que no encontrarás en ningún otro lugar.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square rounded-[3rem] bg-nurei-cta overflow-hidden shadow-2xl rotate-3"
            >
              <div className="absolute inset-x-0 bottom-0 p-12 bg-gradient-to-t from-gray-900/40 to-transparent">
                <p className="text-3xl font-black text-white italic">"Snacking is an art form."</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-[180px] select-none opacity-20">
                🍘
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <Container>
          <div className="relative bg-gray-900 rounded-[3rem] p-12 overflow-hidden text-center space-y-8">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-nurei-cta/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-nurei-cta/10 rounded-full blur-[80px]" />
            
            <h2 className="text-3xl md:text-5xl font-black text-white max-w-2xl mx-auto leading-tight">
              ¿Listo para tu próxima aventura asiática?
            </h2>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/menu">
                <Button className="bg-nurei-cta text-gray-900 hover:bg-white h-14 px-10 rounded-2xl font-black text-lg transition-all shadow-lg shadow-nurei-cta/20">
                  Explorar Menú 🧧
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 h-14 px-10 rounded-2xl font-bold text-lg">
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </PageTransition>
  )
}

import Link from 'next/link'
import { Button } from '@/components/ui/button'
