import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { guardarTickets } from '../../lib/entradasStorage'

// Pantalla a la que vuelve el usuario desde Mercado Pago.
//
// Es el único lugar donde nace el QR de una compra por MP: /api/mp/preferencia
// no devuelve los tokens y /api/mp/estado sólo los suelta con el pago
// acreditado. Si el pago no entra, esta pantalla no tiene nada que guardar —
// que es exactamente lo que se buscaba: sin pago no hay entrada.
//
// Importante: las back_urls de MP NO son prueba de pago — que el navegador
// vuelva por "success" no significa que la plata esté acreditada. El estado
// real lo resuelve /api/mp/estado preguntándole a la API de MP.

type Estado = 'consultando' | 'approved' | 'pending' | 'rejected' | 'error'

interface RespuestaEstado {
  status?: string
  verified?: boolean
  error?: string
  event_id?: string
  tickets?: { token: string; name: string }[]
}

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

  /**
   * Guarda el QR en el dispositivo. Sólo se llama con verified === true, y aun
   * así se revisa que vengan tickets: si el pago se acreditó pero la respuesta
   * llegó vacía, es mejor mandar a /mi-entrada (que los busca por email) que
   * guardar una lista vacía y pisar lo que hubiera.
   */
  const persistirYSalir = useCallback(async (data: RespuestaEstado) => {
    const tickets = data.tickets ?? []
    const eventId = data.event_id

    if (tickets.length > 0 && eventId) {
      const { data: evento } = await supabase
        .from('events')
        .select('name, end_date')
        .eq('id', eventId)
        .single()

      guardarTickets({
        eventId,
        eventName: evento?.name ?? 'Evento',
        endDate: evento?.end_date,
        tickets,
      })
    }

    if (canceladoRef.current) return
    setEstado('approved')
    setTimeout(() => navigate('/mi-entrada'), 1800)
  }, [navigate])

  // El reintento se agenda a través del ref y no llamando a `consultar` desde
  // adentro: una función de useCallback no puede referenciarse a sí misma.
  const consultarRef = useRef<() => void>(() => {})

  const consultar = useCallback(async () => {
    if (canceladoRef.current || !ref) return

    try {
      const res = await fetch(`/api/mp/estado?ref=${encodeURIComponent(ref)}`)
      const data = await res.json() as RespuestaEstado

      if (canceladoRef.current) return

      if (!res.ok) {
        setEstado('error')
        setDetalle(data.error ?? 'No se pudo consultar el pago.')
        return
      }

      if (data.verified || data.status === 'approved') {
        await persistirYSalir(data)
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
      setTimeout(() => consultarRef.current(), INTERVALO_MS)
    } catch {
      if (canceladoRef.current) return
      intentosRef.current += 1
      if (intentosRef.current >= MAX_INTENTOS) {
        setEstado('error')
        setDetalle('Sin conexión con el servidor.')
        return
      }
      setTimeout(() => consultarRef.current(), INTERVALO_MS)
    }
  }, [ref, persistirYSalir])

  // Se declara primero para que el ref ya apunte a la versión actual cuando
  // corre el efecto de abajo (los efectos se ejecutan en orden de declaración).
  useEffect(() => { consultarRef.current = consultar }, [consultar])

  useEffect(() => {
    if (!ref) return
    canceladoRef.current = false
    consultarRef.current()
    return () => { canceladoRef.current = true }
  }, [ref])

  const reintentar = () => {
    intentosRef.current = 0
    canceladoRef.current = false
    setEstado('consultando')
    setDetalle('')
    consultar()
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        <div className="max-w-sm w-full bg-black/60 backdrop-blur-md border border-white/25 rounded-3xl p-7 text-center space-y-4 shadow-2xl">

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
                Tu entrada se genera apenas se acredite — no hace falta pagar de
                nuevo. Podés volver a chequear desde acá.
              </p>
              <button
                onClick={reintentar}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Volver a chequear
              </button>
              <button
                onClick={() => navigate('/mi-entrada')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Ir a mis entradas
              </button>
            </>
          )}

          {estado === 'rejected' && (
            <>
              <p className="text-4xl">😕</p>
              <h2 className="text-white font-bold text-xl">El pago fue rechazado</h2>
              <p className="text-gray-400 text-sm">
                No se generó ninguna entrada. Podés intentar de nuevo con otro
                medio de pago, o escribirnos si el problema sigue.
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
              <p className="text-gray-400 text-xs">
                Si ya pagaste, no vuelvas a hacerlo: la entrada se acredita sola
                cuando Mercado Pago confirma, y aparece en "Mis entradas".
              </p>
              <button
                onClick={reintentar}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Reintentar
              </button>
              <button
                onClick={() => navigate('/mi-entrada')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Ir a mis entradas
              </button>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
