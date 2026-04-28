'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CreditCard, MessageSquare, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProfileData {
  bank_holder: string | null
  bank_clabe: string | null
  bank_name: string | null
}

export default function PaymentInfoRequest() {
  const [hasPaymentInfo, setHasPaymentInfo] = useState(false)

  useEffect(() => {
    fetch('/api/affiliate/profile')
      .then((r) => r.json())
      .then(({ data }) => {
        const paymentInfo = data as ProfileData
        setHasPaymentInfo(!!(paymentInfo.bank_holder && paymentInfo.bank_clabe && paymentInfo.bank_name))
      })
  }, [])

  if (hasPaymentInfo) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-green-800">¡Listo para recibir pagos!</h3>
            <p className="text-xs text-green-700 mt-1">
              Tus datos de pago están registrados. Podrás recibir tus comisiones una vez se aprueben.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-amber-800">Completa tus datos de pago</h3>
          <p className="text-xs text-amber-700 mt-1">
            Para recibir tus comisiones, necesitamos que completes tu información de pago. Esto nos permite procesar tus pagos rápidamente.
          </p>
        </div>
      </div>
      
      <div className="mt-4 bg-white rounded-xl p-3 border border-amber-100">
        <p className="text-[11px] text-gray-600 mb-3 flex items-center gap-1.5">
          <CreditCard className="w-3 h-3" /> Requisitos:
        </p>
        <ul className="text-[10px] text-gray-500 space-y-1 mb-4">
          <li>• Titular de cuenta completo</li>
          <li>• CLABE de 18 dígitos</li>
          <li>• Nombre del banco</li>
          <li>• Método de preferido</li>
        </ul>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.location.href = '/affiliate/perfil'}
            className="h-8 text-xs font-semibold border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Completar datos
          </Button>
          <Button
            size="sm"
            onClick={() => window.location.href = '/affiliate/pagos'}
            className="h-8 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
          >
            Ver pagos
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 bg-amber-100 rounded-lg px-2.5 py-1">
        <MessageSquare className="w-3 h-3 text-amber-600" />
        <p className="text-[10px] text-amber-700 font-medium">
          Completa estos datos para poder liquidar tus comisiones
        </p>
      </div>
    </div>
  )
}