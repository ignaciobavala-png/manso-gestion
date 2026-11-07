import { useEffect, useState } from 'react'
import { Mock, Pagina, Rotulo, Titulo } from '../components/Mock'
import { SALIDAS } from '../lib/mock'
import { useBlur } from '../lib/store'

const hhmm = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

function cuenta(ms: number) {
  if (ms <= 0) return 'Salió'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Transporte() {
  const { reservas, avisos, reservar, avisar } = useBlur()
  // La maqueta fija los horarios relativos al momento de abrir la pantalla.
  const [base] = useState(() => Date.now())
  const [ahora, setAhora] = useState(base)

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const alternarAviso = async (id: string) => {
    if (!avisos.includes(id) && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    avisar(id)
  }

  return (
    <Pagina>
      <Rotulo>Cómo volver</Rotulo>
      <Titulo className="mt-5">Transporte</Titulo>
      <div className="mt-3"><Mock>Horarios de ejemplo</Mock></div>

      <ul className="mt-8">
        {SALIDAS.map((s) => {
          const sale = base + s.enMin * 60000
          const falta = sale - ahora
          const reservada = reservas.includes(s.id)
          const urgente = falta > 0 && falta < 15 * 60000
          return (
            <li key={s.id} className="border-t border-texto py-4">
              <div className="flex items-baseline justify-between">
                <span className="titulo text-5xl">{hhmm(new Date(sale))}</span>
                <span className={`font-mono text-lg ${urgente ? 'pulso text-acento' : 'text-apagado'}`}>{cuenta(falta)}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-apagado">{s.destino} · {s.cupo} lugares</p>
              <p className="mt-2 text-sm text-apagado">{urgente ? 'No pierdas tu micro.' : ' '}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => reservar(s.id)}
                  disabled={falta <= 0}
                  className={reservada ? 'btn' : 'btn-borde'}
                >
                  {reservada ? 'Lugar reservado ✓' : 'Reservar lugar'}
                </button>
                <button
                  onClick={() => alternarAviso(s.id)}
                  disabled={falta <= 0}
                  aria-pressed={avisos.includes(s.id)}
                  className={avisos.includes(s.id) ? 'btn' : 'btn-borde'}
                >
                  {avisos.includes(s.id) ? 'Aviso activo' : 'Avisarme'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </Pagina>
  )
}
