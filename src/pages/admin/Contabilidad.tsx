import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

interface EventoResumen {
  evento: Evento
  r: Resumen
}

interface Mes {
  clave: string
  titulo: string
  r: Resumen
  eventos: EventoResumen[]
}

function claveMes(iso: string | null) {
  if (!iso) return 'sin-fecha'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function tituloMes(clave: string) {
  if (clave === 'sin-fecha') return 'Sin fecha'
  const [y, m] = clave.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function sumar(a: Resumen, b: Resumen): Resumen {
  return {
    total: a.total + b.total,
    mp: a.mp + b.mp,
    transferencia: a.transferencia + b.transferencia,
    web: a.web + b.web,
    mpNeto: a.mpNeto + b.mpNeto,
    mpComision: a.mpComision + b.mpComision,
  }
}

export default function Contabilidad() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Meses y eventos que el usuario abrió o cerró a mano. Lo que no está acá
  // usa el default: sólo el mes actual viene abierto.
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})
  const [eventosAbiertos, setEventosAbiertos] = useState<Record<string, boolean>>({})

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

  const { meses, totales } = useMemo(() => {
    const grupos = new Map<string, Fila[]>()
    for (const f of filas) {
      const g = grupos.get(f.event_id)
      if (g) g.push(f)
      else grupos.set(f.event_id, [f])
    }
    const porMes = new Map<string, Mes>()
    for (const e of eventos) {
      const r = resumir(grupos.get(e.id) ?? [])
      if (r.total === 0) continue
      const clave = claveMes(e.start_date)
      const mes = porMes.get(clave) ?? { clave, titulo: tituloMes(clave), r: vacio(), eventos: [] }
      mes.r = sumar(mes.r, r)
      mes.eventos.push({ evento: e, r })
      porMes.set(clave, mes)
    }
    // Más reciente primero; "sin fecha" al final. Dentro del mes, el evento
    // más reciente arriba (los eventos ya vienen ordenados por fecha desc).
    const meses = [...porMes.values()].sort((a, b) => {
      if (a.clave === 'sin-fecha') return 1
      if (b.clave === 'sin-fecha') return -1
      return b.clave.localeCompare(a.clave)
    })
    return { meses, totales: resumir(filas) }
  }, [eventos, filas])

  if (loading) return <p className="text-gray-400 text-sm text-center py-10">Cargando…</p>
  if (error) return <p className="text-red-400 text-sm text-center py-10">{error}</p>

  const hoy = claveMes(new Date().toISOString())
  const mesAbierto = (clave: string) => mesesAbiertos[clave] ?? clave === hoy

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Contabilidad</h1>
        <p className="text-sm text-gray-400 mt-1">
          Entradas vendidas por evento, según cómo pagaron. Mercado Pago cuenta sólo con el pago acreditado.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tarjeta titulo="Total" valor={totales.total} />
        <Tarjeta titulo="Mercado Pago" valor={totales.mp} />
        <Tarjeta titulo="Transferencia" valor={totales.transferencia} />
      </section>

      {meses.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Todavía no hay entradas vendidas.</p>
      )}

      <div className="space-y-3">
        {meses.map(mes => {
          const abierto = mesAbierto(mes.clave)
          return (
            <section key={mes.clave} className="rounded-lg border border-white/20 bg-neutral-900 overflow-hidden">
              <button
                type="button"
                aria-expanded={abierto}
                onClick={() => setMesesAbiertos(p => ({ ...p, [mes.clave]: !abierto }))}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium capitalize">{mes.titulo}</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    MP {mes.r.mp} · Transf. {mes.r.transferencia}
                    {mes.r.web > 0 && ` · Web ${mes.r.web}`}
                  </p>
                </div>
                <p className="text-white text-xl font-semibold tabular-nums shrink-0">{mes.r.total}</p>
                <ChevronDown
                  size={18}
                  aria-hidden
                  className={`text-gray-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
                />
              </button>

              {abierto && (
                <ul className="border-t border-white/10 divide-y divide-white/10">
                  {mes.eventos.map(({ evento, r }) => {
                    const open = eventosAbiertos[evento.id] ?? false
                    return (
                      <li key={evento.id}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setEventosAbiertos(p => ({ ...p, [evento.id]: !open }))}
                          className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium break-words">{evento.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{fechaEvento(evento.start_date)}</p>
                          </div>
                          <p className="text-white text-lg font-semibold tabular-nums shrink-0">{r.total}</p>
                          <ChevronDown
                            size={16}
                            aria-hidden
                            className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {open && (
                          <div className="px-3 sm:px-4 pb-4">
                            <dl className="grid grid-cols-3 gap-2 text-sm">
                              <Dato etiqueta="Mercado Pago" valor={String(r.mp)} />
                              <Dato etiqueta="Transferencia" valor={String(r.transferencia)} />
                              {r.web > 0 && <Dato etiqueta="Web" valor={String(r.web)} />}
                            </dl>
                            {r.mp > 0 && (
                              <p className="mt-3 text-xs text-gray-400 break-words">
                                MP: neto {pesos(r.mpNeto)} · comisión {pesos(r.mpComision)}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-white/20 bg-neutral-900 px-2 py-3 text-center min-w-0">
      <p className="text-2xl font-semibold text-white tabular-nums">{valor}</p>
      <p className="text-[10px] sm:text-[11px] text-gray-300 mt-0.5 leading-tight">{titulo}</p>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-md bg-neutral-800 px-2 py-2 min-w-0">
      <dt className="text-gray-300 text-[10px] sm:text-xs leading-tight">{etiqueta}</dt>
      <dd className="text-white text-lg font-medium tabular-nums">{valor}</dd>
    </div>
  )
}
