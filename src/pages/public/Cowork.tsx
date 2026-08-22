import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { useCoworkActivo } from '../../hooks/useSeccionPublica'

/**
 * Landing del Manso Cowork Day.
 *
 * No tiene lógica de venta propia: cada fecha es un evento normal
 * (events.cowork_day = true) y el botón lleva al mismo /registro/:slug que
 * usan los shows. Todo lo que ya funciona ahí — Mercado Pago, cupo, QR,
 * "Rechazar QR" — funciona acá sin duplicar nada.
 */

interface CoworkDate {
  id: string
  name: string
  slug: string | null
  start_date: string | null
  regular_ticket_price: number
  is_paid: boolean
  max_capacity: number | null
}

const INCLUYE = [
  { icon: '🪑', label: 'Escritorio por el día', detail: 'De 9 a 18, sin reserva de lugar fijo' },
  { icon: '📶', label: 'Wi-Fi y enchufes', detail: 'Fibra, y un enchufe por puesto' },
  { icon: '☕', label: 'Café de bienvenida', detail: 'El primero va con el pase' },
  { icon: '🤫', label: 'Sala en silencio', detail: 'Las llamadas se atienden en el patio' },
]

export default function Cowork() {
  const navigate = useNavigate()
  const { activo, soloStaff, loading: perillaLoading } = useCoworkActivo()
  const [fechas, setFechas] = useState<CoworkDate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, slug, start_date, regular_ticket_price, is_paid, max_capacity')
      .eq('cowork_day', true)
      .eq('registrations_open', true)
      .eq('is_private', false)
      .is('closed_at', null)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setFechas((data ?? []) as CoworkDate[])
        setLoading(false)
      })
  }, [])

  const registroUrl = (f: CoworkDate) =>
    f.slug ? `/registro/${f.slug}` : `/registro?event=${f.id}`

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // Sección apagada desde Configuración: para el público no existe.
  if (!perillaLoading && !activo) {
    return <Navigate to="/" replace />
  }

  if (loading || perillaLoading) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  const proxima = fechas[0]

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-12">
        <div className="w-full max-w-lg pt-2">
          <button
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white/80 transition-colors text-2xl leading-none"
          >
            ←
          </button>
        </div>

        {soloStaff && (
          <div className="w-full max-w-lg mt-2 bg-amber-950/40 border border-amber-800/40 rounded-2xl px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">Esta página todavía no es pública</p>
            <p className="text-gray-400 text-xs mt-1">
              La ves porque tenés sesión iniciada. Para abrirla al público,
              Control → Secciones → Cowork Day → Público.
            </p>
          </div>
        )}

        <div className="w-full max-w-lg text-center mt-2 mb-8">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Manso</p>
          <h1 className="text-white font-bold text-4xl mt-1">Cowork Day</h1>
          <p className="text-gray-300 text-sm mt-3 leading-relaxed max-w-sm mx-auto">
            Un día de trabajo compartido con nuestra comunidad. Espacio ideal
            para creativos, freelancers, entusiastas o personas con ideas.
          </p>
        </div>

        <div className="w-full max-w-lg grid grid-cols-2 gap-3 mb-8">
          {INCLUYE.map(item => (
            <div
              key={item.label}
              className="bg-black/50 backdrop-blur-md border border-white/15 rounded-2xl p-4"
            >
              <span className="text-2xl">{item.icon}</span>
              <p className="text-white font-semibold text-sm mt-2">{item.label}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-snug">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-lg">
          <h2 className="text-white font-bold text-lg mb-3">Próximas fechas</h2>

          {fechas.length === 0 ? (
            <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl p-6 text-center">
              <p className="text-3xl">🗓️</p>
              <p className="text-white font-semibold text-sm mt-3">
                No hay fechas abiertas por ahora
              </p>
              <p className="text-gray-400 text-xs mt-1.5">
                Seguinos en redes: avisamos cada vez que se abre un día nuevo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fechas.map(f => (
                <button
                  key={f.id}
                  onClick={() => navigate(registroUrl(f))}
                  className="w-full bg-black/50 hover:bg-black/60 backdrop-blur-md border border-white/15 hover:border-emerald-500/50 rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm capitalize">
                      {f.start_date ? formatFecha(f.start_date) : f.name}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {f.start_date ? `Desde las ${formatHora(f.start_date)}` : f.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {f.is_paid && f.regular_ticket_price > 0 ? (
                      <p className="text-emerald-400 font-bold text-sm">
                        ${Number(f.regular_ticket_price).toLocaleString('es-AR')}
                      </p>
                    ) : (
                      <p className="text-emerald-400 font-bold text-sm">Gratis</p>
                    )}
                    <p className="text-gray-500 text-xs mt-0.5">Reservar →</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {proxima && (
          <button
            onClick={() => navigate(registroUrl(proxima))}
            className="w-full max-w-lg mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
          >
            Reservar mi lugar →
          </button>
        )}

        <p className="text-gray-500 text-xs text-center max-w-sm mt-6 leading-relaxed">
          Para reservar te pedimos nombre, teléfono e Instagram. Es un espacio
          chico y compartido: nos gusta saber quién viene.
        </p>
      </div>
    </PublicLayout>
  )
}
