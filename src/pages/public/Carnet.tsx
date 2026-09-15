import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { CalendarClock, DoorOpen, Footprints } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { guardarCredencial, qrDeCredencial } from '../../lib/credencialCowork'

/**
 * El carnet del coworker: /c/<token de su credencial>.
 *
 * Es el link que se le entrega una vez a cada miembro. Hace dos cosas: le
 * muestra su estado —plan, hasta cuándo, en qué sala está— y, de paso, deja
 * su credencial guardada en este navegador. Eso último es lo que después
 * permite que el QR pegado en la puerta de una sala sepa quién la escanea.
 *
 * No pide login: se entra sabiendo el token, igual que /mi-entrada con el de
 * una entrada. Todo lo que se ve sale de un RPC que devuelve nada más que lo
 * que va en pantalla — ni teléfono, ni notas, ni cuánto pagó.
 */

interface Carnet {
  nombre: string
  foto_url: string | null
  puede_entrar: boolean
  motivo: string | null
  llave_tipo: 'dia' | 'mensual' | null
  llave_plan: string | null
  llave_hasta: string | null
  dias_restantes: number | null
  visitas_totales: number
  sala_actual: string | null
  sala_hasta: string | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function CarnetCowork() {
  const { token } = useParams<{ token: string }>()
  const [carnet, setCarnet] = useState<Carnet | null>(null)
  const [cargando, setCargando] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const consultar = useCallback(async () => {
    if (!token) return null
    const { data } = await supabase.rpc('cowork_carnet', { p_token: token })
    return ((data as Carnet[] | null) ?? [])[0] ?? null
  }, [token])

  useEffect(() => {
    let cancelado = false

    consultar().then(c => {
      if (cancelado) return
      setCarnet(c)
      setCargando(false)
      // Solo se guarda si el token sirvió: un link viejo o revocado no puede
      // dejar una credencial muerta pegada en el celular de alguien.
      if (c && token) guardarCredencial(token)
    })

    return () => { cancelado = true }
  }, [consultar, token])

  useEffect(() => {
    if (!canvasRef.current || !token || !carnet) return
    QRCode.toCanvas(canvasRef.current, qrDeCredencial(token), {
      width: 210,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [token, carnet])

  if (cargando) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-gray-400 text-sm">Abriendo tu carnet…</p>
        </div>
      </PublicLayout>
    )
  }

  if (!carnet) {
    return (
      <PublicLayout>
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <h1 className="text-white font-semibold text-lg">Este carnet no existe</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-xs leading-relaxed">
            El link puede estar incompleto, o esta credencial fue dada de baja.
            Escribinos y te mandamos una nueva.
          </p>
        </div>
      </PublicLayout>
    )
  }

  const vence = carnet.dias_restantes

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-12">
        <div className="w-full max-w-sm">

          <div className={`rounded-2xl border p-5 ${
            carnet.puede_entrar
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : 'bg-red-950/40 border-red-500/40'
          }`}>
            <div className="flex items-center gap-3">
              {carnet.foto_url && (
                <img
                  src={carnet.foto_url}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-white font-semibold text-lg truncate">{carnet.nombre}</p>
                <p className={`text-sm ${carnet.puede_entrar ? 'text-emerald-300' : 'text-red-300'}`}>
                  {carnet.puede_entrar
                    ? carnet.llave_tipo === 'dia' ? 'Pase de hoy' : (carnet.llave_plan ?? 'Al día')
                    : (carnet.motivo ?? 'Sin llave vigente')}
                </p>
              </div>
            </div>

            {carnet.puede_entrar && carnet.llave_hasta && (
              <p className="text-gray-300 text-xs mt-4 flex items-center gap-1.5">
                <CalendarClock size={13} aria-hidden />
                {carnet.llave_tipo === 'dia'
                  ? 'Vale por hoy'
                  : vence === 0
                    ? 'Vence hoy'
                    : `Te quedan ${vence} ${vence === 1 ? 'día' : 'días'}`}
              </p>
            )}
          </div>

          {carnet.sala_actual && carnet.sala_hasta && (
            <div className="mt-3 bg-neutral-900 border border-white/20 rounded-2xl p-4 flex items-center gap-2.5">
              <DoorOpen size={16} className="text-terra-400 flex-shrink-0" aria-hidden />
              <p className="text-white text-sm">
                Estás en <span className="font-semibold">{carnet.sala_actual}</span>
                <span className="text-gray-400"> hasta las {hora(carnet.sala_hasta)}</span>
              </p>
            </div>
          )}

          <div className="mt-3 bg-neutral-900 border border-white/20 rounded-2xl p-5 flex flex-col items-center">
            <canvas ref={canvasRef} className="rounded-xl" />
            <p className="text-gray-400 text-xs mt-3 text-center leading-relaxed">
              Mostralo en la puerta.<br />
              Para entrar a una sala, apuntá la cámara al QR de su puerta.
            </p>
          </div>

          <p className="text-gray-500 text-xs mt-4 flex items-center justify-center gap-1.5">
            <Footprints size={13} aria-hidden />
            {carnet.visitas_totales === 0
              ? 'Todavía no registraste ninguna visita'
              : `${carnet.visitas_totales} ${carnet.visitas_totales === 1 ? 'visita' : 'visitas'} hasta ahora`}
          </p>

          <p className="text-gray-600 text-[11px] mt-6 text-center leading-relaxed">
            Guardá este link. Este celular ya te reconoce; si cambiás de
            teléfono, abrilo una vez desde el nuevo.
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
