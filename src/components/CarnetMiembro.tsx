import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { DoorOpen, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { qrDeCredencial } from '../lib/credencialCowork'

/**
 * El carnet del coworker: una carta de identidad, no un porta-QR.
 *
 * Hoy nadie escanea los ingresos —no hay nadie parado en la puerta del
 * cowork—, así que lo que hace útil a esta pantalla no es el QR sino que diga
 * quién sos, que sos socio y que estás al día. Por eso el número, el "socio
 * desde" y el estado son el cuerpo de la tarjeta, y el QR quedó guardado
 * detrás de un botón: sigue estando para cuando el staff lo escanee, pero no
 * ocupa la pantalla mientras nadie lo pida.
 *
 * Lo que de verdad identifica no es el QR igual: es el token, que quedó
 * guardado en este navegador al abrir el carnet. El QR es ese mismo token
 * hecho imagen, para cuando hace falta mostrarlo.
 *
 * Vive en un componente porque se muestra por dos caminos —/c/<token> y
 * /mi-entrada— y lo que ve el miembro no puede depender de por dónde entró.
 * La única diferencia entre los dos es `sala_actual`, que la base manda en
 * null cuando quien mira llegó escribiendo un mail: saber un mail no puede
 * ser saber dónde está sentada una persona.
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
  numero: number
  socio_desde: string | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

const dia = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

const mesYAno = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-gray-400 text-[11px] uppercase tracking-wider">{etiqueta}</dt>
      <dd className="text-white text-sm font-medium mt-0.5 truncate">{children}</dd>
    </div>
  )
}

export default function CarnetMiembro({ carnet, token }: { carnet: Carnet; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tarjetaRef = useRef<HTMLDivElement>(null)
  const [verQr, setVerQr] = useState(false)

  // El reflejo y la inclinación siguen al puntero (mouse o dedo). Se escribe
  // directo en el estilo y no en el estado: cambia en cada movimiento y un
  // re-render por pixel sería tirar el carnet entero al piso.
  const inclinar = (x: number, y: number) => {
    const t = tarjetaRef.current
    if (!t) return
    t.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`
    t.style.setProperty('--ang', `${x * 360 + 180}deg`)
  }

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    inclinar((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5)
  }

  const alSoltar = () => {
    const t = tarjetaRef.current
    if (!t) return
    t.style.transform = ''
    t.style.setProperty('--ang', '0deg')
  }

  // En Android el giroscopio mueve el reflejo sin tocar nada. En iOS pide un
  // permiso con prompt: no lo pedimos por un adorno, ahí queda el puntero.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined
    if (!D || typeof D.requestPermission === 'function') return
    const alOrientar = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return
      const x = Math.max(-1, Math.min(1, e.gamma / 45)) / 2
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 45)) / 2
      inclinar(x, y)
    }
    window.addEventListener('deviceorientation', alOrientar)
    return () => window.removeEventListener('deviceorientation', alOrientar)
  }, [])

  useEffect(() => {
    if (!verQr || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, qrDeCredencial(token), {
      width: 210,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [token, verQr])

  const vence = carnet.dias_restantes

  const vencimiento =
    carnet.llave_tipo === 'dia' ? 'Hoy'
    // null = no vence (el vitalicio), que no es lo mismo que cero.
    : vence === null ? 'No vence'
    : carnet.llave_hasta
      ? `${dia(carnet.llave_hasta)} · ${
          vence === 0 ? 'hoy' : `${vence} ${vence === 1 ? 'día' : 'días'}`}`
      : '—'

  return (
    <div>
      <div
        style={{ perspective: 900 }}
        onPointerMove={alMover}
        onPointerLeave={alSoltar}
        onPointerCancel={alSoltar}
      >
      <div
        ref={tarjetaRef}
        className="relative border border-white/20 bg-gradient-to-br from-manso-black to-manso-carbon overflow-hidden transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="carnet-reflejo" aria-hidden />

        {/* El número del socio como pieza gráfica: calado, grande, cortado
            por el borde. Es el mismo dato que dice "Socio N" arriba. */}
        <span
          className="absolute -right-3 -bottom-8 text-[150px] leading-none font-black tracking-[-0.08em] text-transparent pointer-events-none select-none"
          style={{ WebkitTextStroke: '1px rgba(255, 252, 220, 0.2)' }}
          aria-hidden
        >
          {String(carnet.numero).padStart(3, '0')}
        </span>

        <div className="relative flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="text-gray-400 text-[11px] uppercase tracking-[0.25em]">
            Manso · Cowork
          </span>
          <span className="text-terra-400 text-[11px] uppercase tracking-[0.2em] font-medium">
            Socio {carnet.numero}
          </span>
        </div>

        <div className="relative p-5">
          <div className="flex items-center gap-4">
            {carnet.foto_url ? (
              <img
                src={carnet.foto_url}
                alt=""
                className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-white/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-full flex-shrink-0 bg-terra-600/20 border border-terra-500/40 flex items-center justify-center">
                <span className="text-terra-300 text-2xl font-bold">
                  {carnet.nombre.trim().charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <p className="text-white font-bold text-xl leading-tight truncate">{carnet.nombre}</p>
              <p className="flex items-center gap-2 mt-1.5">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    carnet.puede_entrar ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  aria-hidden
                />
                <span className={`text-sm ${carnet.puede_entrar ? 'text-emerald-300' : 'text-red-300'}`}>
                  {carnet.puede_entrar ? 'Al día' : (carnet.motivo ?? 'Sin llave vigente')}
                </span>
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 mt-5 pt-5 border-t border-white/10">
            <Dato etiqueta="Plan">
              {carnet.llave_tipo === 'dia' ? 'Pase de un día' : (carnet.llave_plan ?? 'Mensual')}
            </Dato>
            <Dato etiqueta="Vence">{vencimiento}</Dato>
            <Dato etiqueta="Socio desde">
              {carnet.socio_desde ? mesYAno(carnet.socio_desde) : '—'}
            </Dato>
            <Dato etiqueta="Visitas">{carnet.visitas_totales}</Dato>
          </dl>
        </div>
      </div>
      </div>

      {carnet.sala_actual && carnet.sala_hasta && (
        <div className="mt-3 bg-neutral-900 border border-white/20 rounded-2xl p-4 flex items-center gap-2.5">
          <DoorOpen size={16} className="text-terra-400 flex-shrink-0" aria-hidden />
          <p className="text-white text-sm">
            Estás en <span className="font-semibold">{carnet.sala_actual}</span>
            <span className="text-gray-300"> hasta las {hora(carnet.sala_hasta)}</span>
          </p>
        </div>
      )}

      <button
        onClick={() => setVerQr(v => !v)}
        className="w-full mt-3 bg-neutral-900/80 hover:bg-neutral-800 border border-white/20 text-white/70 hover:text-white text-sm font-medium py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <QrCode size={15} aria-hidden /> {verQr ? 'Ocultar el QR' : 'Mostrar mi QR'}
      </button>

      {verQr && (
        <div className="mt-3 bg-neutral-900 border border-white/20 rounded-2xl p-5 flex flex-col items-center">
          <canvas ref={canvasRef} className="rounded-xl" />
          <p className="text-gray-400 text-xs mt-3 text-center leading-relaxed">
            Sólo si alguien del staff te lo pide.<br />
            Para entrar a una sala no hace falta: apuntá la cámara al QR de su puerta.
          </p>
        </div>
      )}
    </div>
  )
}
