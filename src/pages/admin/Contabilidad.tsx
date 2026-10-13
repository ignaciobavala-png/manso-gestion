import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { esVendida } from '../../lib/entradas'

interface Evento {
  id: string
  name: string
  start_date: string | null
}

interface Fila {
  event_id: string
  is_banned: boolean
  payment_provider: string | null
  payment_verified: boolean
  mp_expires_at: string | null
  mp_net_amount: number | null
  mp_fee_amount: number | null
}

interface Resumen {
  total: number
  mp: number
  transferencia: number
  web: number
  mpNeto: number
  mpComision: number
}

const PAGE_SIZE = 1000

// Max Rows de Supabase corta en 1000 sin avisar: se pagina hasta agotar.
async function traerTodas(): Promise<Fila[]> {
  const todas: Fila[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('event_id, is_banned, payment_provider, payment_verified, mp_expires_at, mp_net_amount, mp_fee_amount')
      .order('registered_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    todas.push(...(data as Fila[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return todas
}

const vacio = (): Resumen => ({ total: 0, mp: 0, transferencia: 0, web: 0, mpNeto: 0, mpComision: 0 })

function resumir(filas: Fila[]): Resumen {
  const r = vacio()
  for (const f of filas) {
    // Misma regla de "vendida" que el resto del panel (lib/entradas.ts):
    // MP y web sólo cuentan con el pago acreditado, rechazadas no cuentan.
    if (!esVendida(f)) continue
    r.total++
    if (f.payment_provider === 'mercadopago') {
      r.mp++
      r.mpNeto += f.mp_net_amount ?? 0
      r.mpComision += f.mp_fee_amount ?? 0
    } else if (f.payment_provider === 'web') {
      r.web++
    } else {
      r.transferencia++
    }
  }
  return r
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

function fechaEvento(iso: string | null) {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function Contabilidad() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('events').select('id, name, start_date').order('start_date', { ascending: false }),
      traerTodas(),
    ])
      .then(([ev, regs]) => {
        if (ev.error) throw ev.error
        setEventos((ev.data ?? []) as Evento[])
        setFilas(regs)
      })
      .catch(() => setError('No se pudieron cargar las ventas. Probá recargar.'))
      .finally(() => setLoading(false))
  }, [])

  const { porEvento, totales } = useMemo(() => {
    const grupos = new Map<string, Fila[]>()
    for (const f of filas) {
      const g = grupos.get(f.event_id)
      if (g) g.push(f)
      else grupos.set(f.event_id, [f])
    }
    const porEvento = eventos
      .map(e => ({ evento: e, r: resumir(grupos.get(e.id) ?? []) }))
      .filter(x => x.r.total > 0)
    return { porEvento, totales: resumir(filas) }
  }, [eventos, filas])

  if (loading) return <p className="text-gray-400 text-sm text-center py-10">Cargando…</p>
  if (error) return <p className="text-red-400 text-sm text-center py-10">{error}</p>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Contabilidad</h1>
        <p className="text-sm text-gray-400 mt-1">
          Entradas vendidas por evento, según cómo pagaron. Mercado Pago cuenta sólo con el pago acreditado.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Tarjeta titulo="Total" valor={totales.total} />
        <Tarjeta titulo="Mercado Pago" valor={totales.mp} />
        <Tarjeta titulo="Transferencia" valor={totales.transferencia} />
      </section>

      {porEvento.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Todavía no hay entradas vendidas.</p>
      )}

      <ul className="space-y-3">
        {porEvento.map(({ evento, r }) => (
          <li key={evento.id} className="rounded-lg border border-white/15 bg-white/5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{evento.name}</p>
                <p className="text-xs text-gray-400 capitalize">{fechaEvento(evento.start_date)}</p>
              </div>
              <p className="text-white text-2xl font-semibold tabular-nums">
                {r.total}
                <span className="text-xs text-gray-400 font-normal ml-1">vendidas</span>
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Dato etiqueta="Mercado Pago" valor={String(r.mp)} />
              <Dato etiqueta="Transferencia" valor={String(r.transferencia)} />
              {r.web > 0 && <Dato etiqueta="Web" valor={String(r.web)} />}
            </dl>

            {r.mp > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                MP: neto {pesos(r.mpNeto)} · comisión {pesos(r.mpComision)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-center">
      <p className="text-2xl font-semibold text-white tabular-nums">{valor}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{titulo}</p>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{etiqueta}</dt>
      <dd className="text-white text-lg font-medium tabular-nums">{valor}</dd>
    </div>
  )
}
