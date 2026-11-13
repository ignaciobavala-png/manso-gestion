import { ChevronDown, Download, Search } from 'lucide-react'
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
 *
 * Todo lo de acá es presentación: agrupar, plegar y colorear no cambia ningún
 * dato ni ningún número.
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
  qr_mail_enviado_at: string | null
}

type Grupo = 'invitados' | 'por-verificar' | 'en-curso' | 'otras' | 'todas'
type Vista = 'compradores' | 'entradas'

/**
 * Transferencia que cuenta como entrada pero cuyo pago nadie confirmó todavía.
 * Es solo información para la organización: no frena a nadie en la puerta.
 */
const porVerificar = (f: Fila) => esVendida(f) && f.payment_provider === 'transferencia' && !f.payment_verified

/** Quién compró: el mail, que es lo que se repite entre las entradas de una misma compra. */
const compradorDe = (f: Fila) => f.email?.trim().toLowerCase() || f.id

const COLUMNAS =
  'id, event_id, name, email, phone, instagram, registered_at, used_at, payment_verified, is_banned, payment_provider, mp_expires_at, origen, ticket_type_nombre, pack_pos, pack_size, qr_mail_enviado_at'
const PAGINA = 1000

/** De dónde vino la entrada, en palabras de la organización. */
function medio(f: Fila): string {
  if (f.origen === 'web') return 'Web'
  if (f.payment_provider === 'mercadopago') return 'Mercado Pago'
  if (f.payment_provider === 'transferencia') return 'Transferencia'
  return 'Cargada a mano'
}

const csv = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`

/* Vidrio opaco: fondo casi sólido con un poco de desenfoque, borde claro y
   sombra, para que el texto se lea sobre la foto o la textura de atrás. */
const VIDRIO = 'bg-neutral-900/95 backdrop-blur-md border border-white/15 shadow-lg shadow-black/40'
const VIDRIO_INTERNO = 'bg-neutral-800/95 border border-white/10'

/** Color del estado, para que se lea de un vistazo sin tener que leer la palabra. */
function colorEstado(texto: string): string {
  switch (texto) {
    case 'Verificado':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
    case 'Ingresó':
      return 'bg-sky-500/20 text-sky-200 border-sky-400/40'
    case 'Pendiente':
      return 'bg-amber-500/20 text-amber-200 border-amber-400/40'
    case 'Rechazado':
      return 'bg-red-500/20 text-red-200 border-red-400/40'
    default:
      return 'bg-white/10 text-white/80 border-white/25'
  }
}

function FilaEntrada({ f, mostrarContacto }: { f: Fila; mostrarContacto?: boolean }) {
  const estado = etiquetaEstado(f)
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white font-semibold text-[15px] leading-tight break-words min-w-0">{f.name}</p>
        <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${colorEstado(estado)}`}>
          {estado}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-white/75 leading-snug">
        {f.ticket_type_nombre && <span>{etiquetaTipo({ ...f, pack_pos: null, pack_size: null })}</span>}
        {f.pack_pos && f.pack_size && (
          <span className="ml-1.5 px-1.5 py-px rounded bg-white/15 text-white text-[11px] font-semibold">
            {f.pack_pos}/{f.pack_size}
          </span>
        )}
        {f.ticket_type_nombre && <span className="text-white/40"> · </span>}
        <span>{medio(f)}</span>
      </p>
      {mostrarContacto && (f.email || f.phone || f.instagram) && (
        <p className="mt-0.5 text-xs text-white/55 truncate">{[f.email, f.phone, f.instagram].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  )
}

/** Fecha corta del último envío del QR por mail, o la falta de envío. Sólo para entradas de Gestión: las de la web las manda Club. */
function estadoMail(entradas: Fila[]): { texto: string; enviado: boolean } | null {
  const propias = entradas.filter((f) => f.origen === 'gestion' && esVendida(f))
  if (propias.length === 0) return null
  const marcas = propias.map((f) => f.qr_mail_enviado_at).filter((m): m is string => !!m).sort()
  if (marcas.length < propias.length) return { texto: 'Mail del QR: sin enviar', enviado: false }
  const ultima = new Date(marcas[marcas.length - 1]).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return { texto: `Mail del QR: marcado ${ultima}`, enviado: true }
}

/** Un comprador con una sola entrada es una tarjeta común; con varias, una tarjeta con sus entradas adentro. */
function TarjetaComprador({
  entradas,
  agrupar,
  onEnviar,
  enviando,
}: {
  entradas: Fila[]
  agrupar: boolean
  onEnviar: (f: Fila[]) => void
  enviando: boolean
}) {
  const mail = estadoMail(entradas)
  const puedeEnviar = entradas.some((f) => f.origen === 'gestion' && esVendida(f))
  const pie = mail && (
    <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2">
      <p className={`text-xs ${mail.enviado ? 'text-white/65' : 'text-amber-200'}`}>{mail.texto}</p>
      {puedeEnviar && (
        <button
          onClick={() => onEnviar(entradas)}
          disabled={enviando}
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs border border-white/30 text-white hover:border-white/60 disabled:opacity-40"
        >
          {enviando ? 'Enviando…' : mail.enviado ? 'Reenviar QR por mail' : 'Enviar QR por mail'}
        </button>
      )}
    </div>
  )

  if (!agrupar || entradas.length === 1) {
    return (
      <>
        {entradas.map((f) => (
          <li key={f.id} className={`${VIDRIO_INTERNO} rounded-xl overflow-hidden`}>
            <FilaEntrada f={f} mostrarContacto />
            {pie}
          </li>
        ))}
      </>
    )
  }
  const cab = entradas[0]
  return (
    <li className={`${VIDRIO_INTERNO} rounded-xl overflow-hidden border-white/25`}>
      <div className="px-3 py-2 bg-white/10 flex items-center justify-between gap-2">
        <p className="text-white text-xs truncate">{[cab.email, cab.phone].filter(Boolean).join(' · ')}</p>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-terra-400 text-white text-[11px] font-semibold">
          {entradas.length} entradas
        </span>
      </div>
      <ul className="divide-y divide-white/10">
        {entradas.map((f) => (
          <li key={f.id}>
            <FilaEntrada f={f} />
          </li>
        ))}
      </ul>
      {pie}
    </li>
  )
}

export default function Invitados() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [grupo, setGrupo] = useState<Grupo>('invitados')
  const [eventoId, setEventoId] = useState('')
  const [busca, setBusca] = useState('')
  const [vista, setVista] = useState<Vista>('compradores')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [enviandoA, setEnviandoA] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  /** Manda de nuevo el QR por mail a un comprador (api/admin-enviar-entradas). */
  const enviarQr = async (entradas: Fila[]) => {
    const { event_id, email } = entradas[0]
    const cuantas = entradas.filter((f) => f.origen === 'gestion' && esVendida(f)).length
    const ya = entradas.some((f) => f.qr_mail_enviado_at)
    const pregunta = ya
      ? `¿Reenviar el QR de ${cuantas} entrada(s) a ${email}? Le llega de nuevo el mail.`
      : `¿Mandar el QR de ${cuantas} entrada(s) a ${email}?`
    if (!window.confirm(pregunta)) return
    const clave = `${event_id}|${email}`
    setEnviandoA(clave)
    setAviso(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-enviar-entradas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ eventId: event_id, email }),
      })
      const data = (await res.json().catch(() => ({}))) as { enviadas?: number; error?: string }
      if (!res.ok) {
        setAviso({ tipo: 'error', texto: data.error ?? 'No se pudo mandar el mail.' })
        return
      }
      setAviso({ tipo: 'ok', texto: `Mail con el QR enviado a ${email} (${data.enviadas} entrada(s)).` })
      // Refleja la marca nueva sin recargar la lista.
      const ahora = new Date().toISOString()
      setFilas((prev) => prev.map((f) => (f.event_id === event_id && f.email?.trim().toLowerCase() === email ? { ...f, qr_mail_enviado_at: ahora } : f)))
    } catch {
      setAviso({ tipo: 'error', texto: 'Sin conexión. Probá de nuevo.' })
    } finally {
      setEnviandoA(null)
    }
  }

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

  const delGrupo = (f: Fila, g: Grupo) =>
    g === 'todas' ||
    (g === 'invitados' && esVendida(f)) ||
    (g === 'por-verificar' && porVerificar(f)) ||
    (g === 'en-curso' && esReservada(f)) ||
    (g === 'otras' && !esVendida(f) && !esReservada(f))

  const delEvento = (f: Fila) => !eventoId || f.event_id === eventoId
  const cuenta = (g: Grupo) => filas.filter((f) => delEvento(f) && delGrupo(f, g)).length
  const ingresaron = filas.filter((f) => delEvento(f) && esVendida(f) && f.used_at).length
  // Compradores distintos entre las entradas que cuentan: otra forma de contar
  // lo mismo, no cambia ningún dato.
  const compradores = new Set(filas.filter((f) => delEvento(f) && esVendida(f)).map(compradorDe)).size

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return filas.filter(
      (f) =>
        (!eventoId || f.event_id === eventoId) &&
        delGrupo(f, grupo) &&
        (!q || [f.name, f.email, f.phone, f.instagram].some((v) => v?.toLowerCase().includes(q)))
    )
  }, [filas, grupo, eventoId, busca])

  // Una sección por evento; dentro, una tarjeta por comprador.
  const secciones = useMemo(() => {
    return eventos
      .map((e) => {
        const delE = visibles.filter((f) => f.event_id === e.id)
        const m = new Map<string, Fila[]>()
        for (const f of delE) m.set(compradorDe(f), [...(m.get(compradorDe(f)) ?? []), f])
        return { evento: e, entradas: delE, compradores: [...m.values()] }
      })
      .filter((s) => s.entradas.length > 0)
  }, [eventos, visibles])

  // Buscando o mirando un solo evento no tiene sentido tener todo cerrado.
  const forzarAbierto = busca.trim() !== '' || eventoId !== ''
  const estaAbierta = (id: string) => forzarAbierto || abiertos.has(id)
  const alternar = (id: string) =>
    setAbiertos((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const todasAbiertas = secciones.length > 0 && secciones.every((s) => abiertos.has(s.evento.id))

  const exportar = () => {
    const nombreEvento = new Map(eventos.map((e) => [e.id, e.name]))
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
    ['por-verificar', 'Por verificar'],
    ['en-curso', 'Pagando'],
    ['otras', 'Sin valor'],
    ['todas', 'Todas'],
  ]

  const NUMEROS: [string, number][] = [
    ['Entradas', cuenta('invitados')],
    ['Compradores', compradores],
    ['Ya ingresaron', ingresaron],
    ['Por verificar', cuenta('por-verificar')],
    ['Pagando', cuenta('en-curso')],
  ]

  const boton = (activo: boolean) =>
    `px-3 py-1.5 rounded-xl text-sm border transition-colors ${
      activo ? 'bg-white text-black border-white font-medium' : 'border-white/25 text-white/80 hover:text-white hover:border-white/50'
    }`

  return (
    <div className="px-4 pt-4 pb-24 max-w-5xl mx-auto w-full space-y-4">
      <h1 className="text-white font-bold text-xl">Invitados</h1>

      {error && <p className="text-red-200 text-sm">{error}</p>}
      {aviso && (
        <p className={`text-sm rounded-xl px-3 py-2 border ${aviso.tipo === 'ok' ? 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10' : 'text-red-200 border-red-400/40 bg-red-500/10'}`}>
          {aviso.texto}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {NUMEROS.map(([texto, n]) => (
          <div key={texto} className={`${VIDRIO} rounded-2xl px-4 py-3`}>
            <p className="text-3xl font-bold text-white leading-none">{n}</p>
            <p className="mt-1.5 text-xs uppercase tracking-wider text-white/65">{texto}</p>
          </div>
        ))}
      </div>

      <div className={`${VIDRIO} rounded-2xl p-3 space-y-3`}>
        <div className="flex flex-wrap gap-2 items-center">
          {GRUPOS.map(([id, texto]) => (
            <button key={id} onClick={() => setGrupo(id)} className={boton(grupo === id)}>
              {texto} ({cuenta(id)})
            </button>
          ))}
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-sm bg-neutral-800 border border-white/25 text-white"
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

        <div className="flex flex-wrap gap-2">
          <label className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800 border border-white/25 text-white">
            <Search size={16} aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nombre, mail, teléfono o Instagram"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/50"
            />
          </label>
          <div className="flex gap-2" role="group" aria-label="Cómo ver la lista">
            <button onClick={() => setVista('compradores')} aria-pressed={vista === 'compradores'} className={boton(vista === 'compradores')}>
              Por comprador
            </button>
            <button onClick={() => setVista('entradas')} aria-pressed={vista === 'entradas'} className={boton(vista === 'entradas')}>
              Una por una
            </button>
          </div>
          <button
            onClick={exportar}
            disabled={!visibles.length}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/25 text-sm text-white hover:border-white/50 disabled:opacity-40"
          >
            <Download size={16} aria-hidden /> CSV
          </button>
        </div>
      </div>

      {cargando ? (
        <p className="text-white/70 text-sm py-10 text-center">Cargando…</p>
      ) : secciones.length === 0 ? (
        <p className="text-white/70 text-sm py-10 text-center">No hay entradas con ese filtro.</p>
      ) : (
        <>
          {!forzarAbierto && secciones.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={() => setAbiertos(todasAbiertas ? new Set() : new Set(secciones.map((s) => s.evento.id)))}
                className="text-sm text-white/80 underline underline-offset-4 hover:text-white"
              >
                {todasAbiertas ? 'Cerrar todo' : 'Abrir todo'}
              </button>
            </div>
          )}
          <div className="space-y-3">
            {secciones.map(({ evento, entradas, compradores: grupos }) => {
              const abierta = estaAbierta(evento.id)
              return (
                <section key={evento.id} className={`${VIDRIO} rounded-2xl overflow-hidden`}>
                  <button
                    onClick={() => alternar(evento.id)}
                    aria-expanded={abierta}
                    disabled={forzarAbierto}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-white font-semibold">{evento.name}</span>
                      <span className="block text-[13px] text-white/70">
                        {entradas.length} {entradas.length === 1 ? 'entrada' : 'entradas'} · {grupos.length}{' '}
                        {grupos.length === 1 ? 'comprador' : 'compradores'}
                      </span>
                    </span>
                    <ChevronDown
                      size={20}
                      aria-hidden
                      className={`shrink-0 text-white/70 transition-transform ${abierta ? 'rotate-180' : ''} ${forzarAbierto ? 'opacity-30' : ''}`}
                    />
                  </button>
                  {abierta && (
                    <ul className="grid gap-2 md:grid-cols-2 p-3 pt-0">
                      {grupos.map((g) => (
                        <TarjetaComprador
                          key={compradorDe(g[0]) + g[0].id}
                          entradas={g}
                          agrupar={vista === 'compradores'}
                          onEnviar={enviarQr}
                          enviando={enviandoA === `${g[0].event_id}|${compradorDe(g[0])}`}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
