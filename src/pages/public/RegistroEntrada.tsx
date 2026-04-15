import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

interface ActiveEvent {
  id: string
  name: string
}

const LS_KEY = (eventId: string) => `manso_ticket_${eventId}`

export default function RegistroEntrada() {
  const navigate = useNavigate()
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('active_event')
      .select('id, name')
      .single()
      .then(({ data }) => {
        setLoadingEvent(false)
        if (!data) return
        setActiveEvent(data as ActiveEvent)

        const saved = localStorage.getItem(LS_KEY(data.id))
        if (saved) {
          navigate('/mi-entrada', { replace: true })
        }
      })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEvent || !accepted) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/registro-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), event_id: activeEvent.id })
      })

      const data = await res.json()

      if (res.status === 409) {
        setError('Ya tenés una entrada para este evento. Si la perdiste, acercate a la puerta.')
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Algo salió mal. Intentá de nuevo.')
        setSubmitting(false)
        return
      }

      localStorage.setItem(
        LS_KEY(activeEvent.id),
        JSON.stringify({ token: data.token, name: name.trim(), event_name: activeEvent.name, event_id: activeEvent.id })
      )
      navigate('/mi-entrada')
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  if (loadingEvent) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  if (!activeEvent) {
    return (
      <PublicLayout>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 -mt-12">
          <p className="text-4xl">🎵</p>
          <h2 className="text-2xl font-bold text-white">No hay evento esta noche</h2>
          <p className="text-gray-400 text-sm max-w-xs">Seguinos en redes para enterarte de la próxima fecha.</p>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col px-5 pb-10">
        {/* Nombre del evento */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-xs uppercase tracking-[0.25em] mb-2">esta noche</p>
          <h2 className="text-2xl font-bold text-white">{activeEvent.name}</h2>
          <div className="mt-3 inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-800/60 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium tracking-wide">Entrada disponible</span>
          </div>
        </div>

        {/* Card del formulario */}
        <div className="max-w-sm w-full mx-auto">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-5">
            <div>
              <h3 className="text-white font-semibold text-lg">Reservá tu lugar</h3>
              <p className="text-gray-400 text-sm mt-1">
                Ponés tu nombre y mail, y te generamos un QR para entrar sin esperar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Tu nombre"
                  className="w-full bg-white/10 border border-white/15 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Tu email"
                  className="w-full bg-white/10 border border-white/15 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={e => setAccepted(e.target.checked)}
                  className="mt-0.5 accent-emerald-500 w-4 h-4 flex-shrink-0"
                />
                <span className="text-gray-400 text-xs leading-relaxed">
                  Acepto que Manso guarde mis datos para avisarme de próximas fechas.
                </span>
              </label>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !accepted || !name.trim() || !email.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
              >
                {submitting ? 'Generando tu entrada...' : 'Quiero mi entrada →'}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-600 text-xs mt-5">
            El QR queda guardado en este dispositivo
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
