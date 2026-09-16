import { useEffect, useRef } from 'react'
import { CalendarClock, DoorOpen, Footprints } from 'lucide-react'
import QRCode from 'qrcode'
import { qrDeCredencial } from '../lib/credencialCowork'

/**
 * El carnet del coworker, como tarjeta.
 *
 * Vive en un componente y no dentro de una pantalla porque se muestra por dos
 * caminos: /c/<token>, que es el link que se entrega una vez, y /mi-entrada,
 * donde la persona llega escribiendo su mail. Lo que ve tiene que ser lo
 * mismo por los dos lados — si no, cada camino termina contando una historia
 * distinta sobre el mismo estado.
 */

export interface Carnet {
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
  email: string | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function CarnetMiembro({ carnet, token }: { carnet: Carnet; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, qrDeCredencial(token), {
      width: 210,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [token])

  const vence = carnet.dias_restantes

  return (
    <div>
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

        {carnet.puede_entrar && (
          <p className="text-gray-300 text-xs mt-4 flex items-center gap-1.5">
            <CalendarClock size={13} aria-hidden />
            {carnet.llave_tipo === 'dia'
              ? 'Vale por hoy'
              // null = no vence (vitalicio), que no es lo mismo que cero.
              : vence === null
                ? 'Sin vencimiento'
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
    </div>
  )
}
