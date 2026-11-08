import { Download, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { esReservada, esVendida, etiquetaEstado, etiquetaTipo } from '../../../lib/entradas'

/**
 * Lista de invitados del festival: una fila por entrada (una persona, un QR)
 * de TODOS los eventos BLUR de Gestión — hoy "BLUR", "BLUR + LANCHA" y
 * "BLUR + Estacionamiento" —, vendidas por la web, por la página de registro
 * o cargadas a mano. Solo lectura: se edita en Entradas.
 *
 * "Invitado" = entrada que cuenta como vendida (regla de lib/entradas, la
 * misma de la DB). Las reservas sin pagar y las rechazadas se ven aparte, para
 * que no inflen el total.
 */

interface Evento { id: string; name: string }

interface Fila {
  id: string
  event_id: string
  name: string
  email: string
  phone: string | null
  instagram: string | null
  registered_at: string
  used_at: string | null
  payment_verified: boolean
  is_banned: boolean
  payment_provider: string | null
  mp_expires_at: string | null
  origen: 'gestion' | 'web'
  ticket_type_nombre: string | null
  pack_pos: number | null
  pack_size: number | null
}

type Grupo = 'invitados' | 'en-curso' | 'otras' | 'todas'

const COLUMNAS =
  'id, event_id, name, email, phone, instagram, registered_at, used_at, payment_verified, is_banned, payment_provider, mp_expires_at, origen, ticket_type_nombre, pack_pos, pack_size'
const PAGINA = 1000

/** De dónde vino la entrada, en palabras de la organización. */
function medio(f: Fila): string {
  if (f.origen === 'web') return 'Web'
  if (f.payment_provider === 'mercadopago') return 'Mercado Pago'
  if (f.payment_provider === 'transferencia') return 'Transferencia'
  return 'Cargada a mano'
}

const csv = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function Invitados() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [grupo, setGrupo] = useState<Grupo>('invitados')
  const [eventoId, setEventoId] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: evs, error: eEv } = await supabase.from('events').select('id, name').ilike('name', 'BLUR%').order('name')
      if (!vivo) return
      if (eEv) {
        setError('No se pudieron leer los eventos.')
        setCargando(false)
        return
      }
      const lista = (evs ?? []) as Evento[]
      setEventos(lista)
      // Paginado: el servidor corta en "Max Rows" sin avisar y la lista quedaría trunca.
      const todas: Fila[] = []
      const ids = lista.map((e) => e.id)
      for (let desde = 0; ids.length; desde += PAGINA) {
        const { data, error: eFilas } = await supabase
          .from('ticket_registrations')
          .select(COLUMNAS)
          .in('event_id', ids)
          .order('registered_at', { ascending: false })
          .range(desde, desde + PAGINA - 1)
        if (!vivo) return
        if (eFilas) {
          setError('No se pudieron leer las entradas.')
          setCargando(false)
          return
        }
        todas.push(...((data ?? []) as Fila[]))
        if ((data ?? []).length < PAGINA) break
      }
      setFilas(todas)
      setCargando(false)
    })()
    return () => {
      vivo = false
    }
  }, [])

  const nombreEvento = useMemo(() => new Map(eventos.map((e) => [e.id, e.name])), [eventos])

  const delGrupo = (f: Fila, g: Grupo) =>
    g === 'todas' ||
    (g === 'invitados' && esVendida(f)) ||
    (g === 'en-curso' && esReservada(f)) ||
    (g === 'otras' && !esVendida(f) && !esReservada(f))

  const cuenta = (g: Grupo) => filas.filter((f) => (!eventoId || f.event_id === eventoId) && delGrupo(f, g)).length
  const ingresaron = filas.filter((f) => (!eventoId || f.event_id === eventoId) && esVendida(f) && f.used_at).length

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return filas.filter(
      (f) =>
        (!eventoId || f.event_id === eventoId) &&
        delGrupo(f, grupo) &&
        (!q || [f.name, f.email, f.phone, f.instagram].some((v) => v?.toLowerCase().includes(q)))
    )
  }, [filas, grupo, eventoId, busca])

  const exportar = () => {
    const cab = ['Nombre', 'Email', 'Teléfono', 'Instagram', 'Evento', 'Tipo', 'Medio', 'Estado', 'Registrada']
    const lineas = visibles.map((f) =>
      [
        f.name,
        f.email,
        f.phone,
        f.instagram,
        nombreEvento.get(f.event_id),
        etiquetaTipo(f),
        medio(f),
        etiquetaEstado(f),
        f.registered_at.slice(0, 16).replace('T', ' '),
      ]
        .map(csv)
        .join(',')
    )
    const blob = new Blob(['﻿' + [cab.map(csv).join(','), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `blur-invitados-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const GRUPOS: [Grupo, string][] = [
    ['invitados', 'Invitados'],
    ['en-curso', 'Pagando'],
    ['otras', 'Sin valor'],
    ['todas', 'Todas'],
  ]

  return (
    <div className="px-4 pt-4 pb-24 max-w-5xl mx-auto w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-white font-bold text-xl">Invitados</h1>
        <p className="text-white/60 text-sm">
          {cuenta('invitados')} invitados · {ingresaron} ya ingresaron · {cuenta('en-curso')} pagando
        </p>
      </div>

      {error && <p className="text-red-300 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        {GRUPOS.map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setGrupo(id)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              grupo === id ? 'bg-white text-black border-white' : 'border-white/20 text-white/60 hover:text-white'
            }`}
          >
            {texto} ({cuenta(id)})
          </button>
        ))}
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-sm bg-black border border-white/20 text-white/80"
          aria-label="Evento"
        >
          <option value="">Todos los BLUR</option>
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/20 text-white/80">
          <Search size={16} aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nombre, mail, teléfono o Instagram"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/40"
          />
        </label>
        <button
          onClick={exportar}
          disabled={!visibles.length}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/20 text-sm text-white/80 hover:text-white disabled:opacity-40"
        >
          <Download size={16} aria-hidden /> CSV
        </button>
      </div>

      {cargando ? (
        <p className="text-white/50 text-sm py-10 text-center">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="text-white/50 text-sm py-10 text-center">No hay entradas con ese filtro.</p>
      ) : (
        <ul className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden">
          {visibles.map((f) => (
            <li key={f.id} className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{f.name}</p>
                <p className="text-white/50 text-xs truncate">
                  {[f.email, f.phone, f.instagram].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="text-right text-xs text-white/60">
                <p>
                  {nombreEvento.get(f.event_id)}
                  {etiquetaTipo(f) ? ` · ${etiquetaTipo(f)}` : ''}
                </p>
                <p>
                  {medio(f)} · <span className="text-white/90">{etiquetaEstado(f)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
