import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'

// Pantalla a la que vuelve el usuario desde Mercado Pago.
//
// Importante: las back_urls de MP NO son prueba de pago — que el navegador
// vuelva por "success" no significa que la plata esté acreditada. El estado
// real se consulta contra /api/mp/estado, que le pregunta a la API de MP.
//
// El QR ya existe desde antes de pagar (mismo modelo que transferencia), así
// que si el pago queda pendiente el usuario igual llega a su entrada; la va a
// ver como pendiente de verificación, igual que hoy con las transferencias.

type Estado = 'consultando' | 'approved' | 'pending' | 'rejected' | 'error'

const INTERVALO_MS = 2500
const MAX_INTENTOS = 16 // ~40 segundos

export default function PagoRetorno() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ref = searchParams.get('ref')

  // Sin ref no hay nada que consultar: es estado inicial, no un efecto.
  const [estado, setEstado] = useState<Estado>(ref ? 'consultando' : 'error')
  const [detalle, setDetalle] = useState<string>(
    ref ? '' : 'No se recibió la referencia del pago.'
  )
  const intentosRef = useRef(0)
  const canceladoRef = useRef(false)

  useEffect(() => {
    if (!ref) return

    canceladoRef.current = false

    async function consultar() {
      if (canceladoRef.current) return

      try {
        const res = await fetch(`/api/mp/estado?ref=${encodeURIComponent(ref!)}`)
        const data = await res.json()

        if (canceladoRef.current) return

        if (!res.ok) {
          setEstado('error')
          setDetalle(data.error ?? 'No se pudo consultar el pago.')
          return
        }

        if (data.verified || data.status === 'approved') {
          setEstado('approved')
          setTimeout(() => navigate('/mi-entrada'), 1800)
          return
        }

        if (data.status === 'rejected' || data.status === 'cancelled') {
          setEstado('rejected')
          return
        }

        // in_process / pending / authorized: MP todavía no resolvió.
        intentosRef.current += 1
        if (intentosRef.current >= MAX_INTENTOS) {
          setEstado('pending')
          return
        }
        setTimeout(consultar, INTERVALO_MS)
      } catch {
        if (canceladoRef.current) return
        intentosRef.current += 1
        if (intentosRef.current >= MAX_INTENTOS) {
          setEstado('error')
          setDetalle('Sin conexión con el servidor.')
          return
        }
        setTimeout(consultar, INTERVALO_MS)
      }
    }

    consultar()

    return () => { canceladoRef.current = true }
  }, [ref, navigate])

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        <div className="max-w-sm w-full bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl p-7 text-center space-y-4 shadow-2xl">

          {estado === 'consultando' && (
            <>
              <div className="mx-auto animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
              <h2 className="text-white font-bold text-xl">Confirmando tu pago</h2>
              <p className="text-gray-400 text-sm">
                Estamos verificando con Mercado Pago. No cierres esta pantalla.
              </p>
            </>
          )}

          {estado === 'approved' && (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white font-bold text-xl">¡Pago confirmado!</h2>
              <p className="text-gray-400 text-sm">Preparando tu QR...</p>
            </>
          )}

          {estado === 'pending' && (
            <>
              <p className="text-4xl">⏳</p>
              <h2 className="text-white font-bold text-xl">Tu pago está en proceso</h2>
              <p className="text-gray-400 text-sm">
                Mercado Pago todavía no lo confirmó. Suele tardar unos minutos.
                Tu entrada ya está generada — cuando se acredite queda
                verificada automáticamente.
              </p>
              <button
                onClick={() => navigate('/mi-entrada')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Ver mi entrada →
              </button>
            </>
          )}

          {estado === 'rejected' && (
            <>
              <p className="text-4xl">😕</p>
              <h2 className="text-white font-bold text-xl">El pago fue rechazado</h2>
              <p className="text-gray-400 text-sm">
                No se pudo procesar el pago. Podés intentar de nuevo con otro
                medio, o escribirnos si el problema sigue.
              </p>
              <button
                onClick={() => navigate('/registro')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Volver a los eventos
              </button>
            </>
          )}

          {estado === 'error' && (
            <>
              <p className="text-4xl">⚠️</p>
              <h2 className="text-white font-bold text-xl">No pudimos verificar el pago</h2>
              <p className="text-gray-400 text-sm">
                {detalle || 'Intentá de nuevo en un momento.'}
              </p>
              <p className="text-gray-500 text-xs">
                Si ya pagaste, no vuelvas a hacerlo: tu entrada existe y el
                staff puede verificarla.
              </p>
              <button
                onClick={() => navigate('/mi-entrada')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Ver mi entrada →
              </button>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
