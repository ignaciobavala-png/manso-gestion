import { Camera, Check, CheckCheck, Copy, Download, ExternalLink, Mail, Trash2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Fotos de Analógica (app de BLUR, carpeta blur/). Llegan solas al bucket
 * privado `blur-analogica`; acá la organización decide foto por foto:
 * sin revisar → para publicar, o revisada y no se publica (migración 045).
 * El bucket no tiene lectura pública: se ven con URLs firmadas que vencen.
 *
 * Pestaña "Revelado": cuándo abre el revelado público de la app (migración 047).
 *
 * Pestaña "Rollos": cada teléfono es una cámara descartable con 10 fotos y su
 * link personal (/blur/rollo/<token>, migración 046). Desde ahí la organización
 * copia el link o se lo manda por mail a quien dejó su contacto.
 */
const BUCKET = 'blur-analogica'
const VENCE_SEG = 60 * 60

interface Foto {
  id: string
  path: string
  filtro: string | null
  publicada: boolean
  descartada: boolean
  created_at: string
  dispositivo: string
  url?: string
}

interface RolloFila {
  dispositivo: string
  token: string
  numero: string
  contacto: string | null
  enviado_at: string | null
  created_at: string
  /** La entrada que activó este rollo (migración 048); null = rollo sin activar o anterior a la 048. */
  entrada: { name: string; email: string } | null
}

type Estado = 'sin-revisar' | 'publicar' | 'descartada'
type Filtro = 'todas' | Estado

const estadoDe = (f: Foto): Estado => (f.publicada ? 'publicar' : f.descartada ? 'descartada' : 'sin-revisar')

export default function FotosBlur() {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('sin-revisar')
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [vista, setVista] = useState<'fotos' | 'rollos' | 'revelado'>('fotos')
  const [rollos, setRollos] = useState<RolloFila[]>([])

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('blur_fotos')
      .select('id, path, filtro, publicada, descartada, created_at, dispositivo')
      .order('created_at', { ascending: false })
      .limit(500)
    if (e) {
      setError('No se pudieron leer las fotos.')
      setCargando(false)
      return
    }
    const filas = (data ?? []) as Foto[]
    const { data: firmadas } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(filas.map((f) => f.path), VENCE_SEG)
    const porPath = new Map((firmadas ?? []).map((s) => [s.path, s.signedUrl]))
    setFotos(filas.map((f) => ({ ...f, url: porPath.get(f.path) ?? undefined })))
    const { data: filasRollos, error: eRollos } = await supabase
      .from('blur_rollos')
      .select('dispositivo, token, numero, contacto, enviado_at, created_at, entrada:ticket_registrations!entrada_id(name, email)')
      .order('created_at', { ascending: false })
    if (eRollos) setError('No se pudieron leer los rollos.')
    else {
      // PostgREST devuelve el embed to-one como objeto (los tipos generados dicen array).
      setRollos(
        ((filasRollos ?? []) as unknown as (Omit<RolloFila, 'entrada'> & { entrada: RolloFila['entrada'] | RolloFila['entrada'][] })[]).map(
          (r) => ({ ...r, entrada: Array.isArray(r.entrada) ? (r.entrada[0] ?? null) : (r.entrada ?? null) }),
        ),
      )
      setError('')
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
  }, [cargar])

  const decidir = async (f: Foto, estado: Estado) => {
    setOcupada(f.id)
    const marcas = { publicada: estado === 'publicar', descartada: estado === 'descartada' }
    const { error: e } = await supabase.from('blur_fotos').update(marcas).eq('id', f.id)
    if (e) setError('No se pudo guardar el cambio.')
    else setFotos((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...marcas } : x)))
    setOcupada(null)
  }

  const borrar = async (f: Foto) => {
    if (!window.confirm('¿Borrar esta foto para siempre?')) return
    setOcupada(f.id)
    // Primero el archivo: si falla, la fila sigue y se puede reintentar.
    const { error: eArchivo } = await supabase.storage.from(BUCKET).remove([f.path])
    if (eArchivo) {
      setError('No se pudo borrar el archivo.')
      setOcupada(null)
      return
    }
    const { error: eFila } = await supabase.from('blur_fotos').delete().eq('id', f.id)
    if (eFila) setError('Se borró el archivo pero no la fila. Recargá.')
    else setFotos((fs) => fs.filter((x) => x.id !== f.id))
    setOcupada(null)
  }

  const cuenta = (e: Estado) => fotos.filter((f) => estadoDe(f) === e).length
  const visibles = fotos.filter((f) => filtro === 'todas' || estadoDe(f) === filtro)

  return (
    <div className="px-4 pt-4 pb-24 max-w-5xl mx-auto w-full space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-white font-bold text-xl">Fotos de Analógica</h1>
        <p className="text-white/60 text-sm">
          {fotos.length} recibidas · {cuenta('sin-revisar')} sin revisar · {cuenta('publicar')} para publicar ·{' '}
          {cuenta('descartada')} descartadas
        </p>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-3">
        {(
          [
            ['fotos', 'Fotos'],
            ['rollos', `Rollos (${rollos.length})`],
            ['revelado', 'Revelado'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              vista === id ? 'bg-white text-black border-white' : 'border-white/20 text-white/60 hover:text-white'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {vista === 'revelado' ? (
        <ControlRevelado fotos={fotos} onError={setError} />
      ) : vista === 'rollos' ? (
        <ListaRollos rollos={rollos} fotos={fotos} cargando={cargando} onCambio={cargar} onError={setError} />
      ) : (
      <>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['sin-revisar', `Sin revisar (${cuenta('sin-revisar')})`],
            ['publicar', `Para publicar (${cuenta('publicar')})`],
            ['descartada', `No se publican (${cuenta('descartada')})`],
            ['todas', 'Todas'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              filtro === id
                ? 'border-terra-400 text-terra-400'
                : 'border-white/20 text-white/60 hover:text-white'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-white/60 text-sm">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="bg-black/40 border border-white/20 rounded-2xl p-8 text-center">
          <Camera className="mx-auto text-white/30" size={32} strokeWidth={1.25} aria-hidden />
          <p className="text-white/60 text-sm mt-3">
            {fotos.length === 0 ? 'Todavía no llegó ninguna foto.' : 'No hay fotos en esta vista.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibles.map((f) => (
            <li
              key={f.id}
              className={`bg-black/40 border rounded-2xl overflow-hidden ${
                f.publicada ? 'border-olive-500' : f.descartada ? 'border-red-400/50 opacity-70' : 'border-white/20'
              }`}
            >
              <div className="relative aspect-[3/4] bg-gray-800/80">
                {f.url ? (
                  <img src={f.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">
                    Sin archivo
                  </span>
                )}
                {f.filtro && (
                  <span className="absolute left-2 top-2 bg-black/70 text-white/80 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                    {f.filtro}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 p-2">
                {estadoDe(f) === 'sin-revisar' ? (
                  <>
                    <button
                      onClick={() => decidir(f, 'publicar')}
                      disabled={ocupada === f.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50"
                    >
                      <Check size={16} strokeWidth={2} aria-hidden />
                      Publicar
                    </button>
                    <button
                      onClick={() => decidir(f, 'descartada')}
                      disabled={ocupada === f.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border border-white/30 text-white/80 hover:text-white disabled:opacity-50"
                    >
                      <X size={16} strokeWidth={2} aria-hidden />
                      No
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => decidir(f, 'sin-revisar')}
                    disabled={ocupada === f.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ${
                      f.publicada ? 'bg-olive-600 text-white' : 'border border-red-400/50 text-red-300'
                    }`}
                  >
                    <Undo2 size={16} strokeWidth={2} aria-hidden />
                    {f.publicada ? 'Se publica · deshacer' : 'No se publica · deshacer'}
                  </button>
                )}
                {f.url && (
                  <a
                    href={f.url}
                    download={`blur-${f.id.slice(0, 8)}.jpg`}
                    aria-label="Descargar"
                    className="p-2 rounded-xl text-white/60 hover:text-white"
                  >
                    <Download size={18} strokeWidth={1.5} aria-hidden />
                  </a>
                )}
                <button
                  onClick={() => borrar(f)}
                  disabled={ocupada === f.id}
                  aria-label="Borrar"
                  className="p-2 rounded-xl text-white/60 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 size={18} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  )
}

/** Cuántas fotos de un rollo hay en cada estado (de las que ya cargó el panel). */
function resumen(fotos: Foto[]) {
  let publicar = 0
  let descartadas = 0
  for (const f of fotos) {
    if (f.publicada) publicar++
    else if (f.descartada) descartadas++
  }
  return { total: fotos.length, publicar, descartadas, sinRevisar: fotos.length - publicar - descartadas }
}

function ListaRollos({
  rollos,
  fotos,
  cargando,
  onCambio,
  onError,
}: {
  rollos: RolloFila[]
  fotos: Foto[]
  cargando: boolean
  onCambio: () => Promise<void>
  onError: (m: string) => void
}) {
  const [soloConMail, setSoloConMail] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  // Llave de blur_config (migración 048): si está prendida, el servidor solo
  // acepta fotos de rollos activados con el código de una entrada.
  const [exige, setExige] = useState<boolean | null>(null)

  useEffect(() => {
    void supabase
      .from('blur_config')
      .select('rollo_requiere_entrada')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => setExige(data ? Boolean(data.rollo_requiere_entrada) : null))
  }, [])

  const cambiarExige = async () => {
    if (exige === null) return
    const nuevo = !exige
    if (nuevo && !window.confirm('¿Pedir entrada para sacar fotos? Quien no active su rollo con el código de su entrada no va a poder sacar más fotos.')) return
    const { error } = await supabase.from('blur_config').update({ rollo_requiere_entrada: nuevo }).eq('id', true)
    if (error) onError('No se pudo cambiar la configuración.')
    else setExige(nuevo)
  }

  const porRollo = new Map<string, Foto[]>()
  for (const f of fotos) porRollo.set(f.dispositivo, [...(porRollo.get(f.dispositivo) ?? []), f])

  // Los rollos sin fotos (se borraron todas) no tienen nada que mandar.
  const filas = rollos.filter((r) => porRollo.has(r.dispositivo) && (!soloConMail || r.contacto))

  const link = (r: RolloFila) => `${window.location.origin}/blur/rollo/${r.token}`

  const copiar = async (r: RolloFila) => {
    try {
      await navigator.clipboard.writeText(link(r))
      setCopiado(r.dispositivo)
      setTimeout(() => setCopiado((c) => (c === r.dispositivo ? null : c)), 2000)
    } catch {
      onError('No se pudo copiar. Abrí el link y copialo desde la barra.')
    }
  }

  // El mail al que mandar: el que dejó la persona, o el de la entrada que activó el rollo.
  const destino = (r: RolloFila) => r.contacto ?? r.entrada?.email ?? null

  const mailto = (r: RolloFila) => {
    const asunto = 'Tus fotos del rollo analógico de BLUR'
    const cuerpo = `Hola!\n\nAcá están las fotos de tu rollo (Nº ${r.numero}). Podés verlas y guardarlas todas juntas desde este link:\n\n${link(r)}\n\n¡Gracias por sacar fotos con nosotros!`
    return `mailto:${destino(r)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  const marcarEnviado = async (r: RolloFila) => {
    const { error } = await supabase
      .from('blur_rollos')
      .update({ enviado_at: r.enviado_at ? null : new Date().toISOString() })
      .eq('dispositivo', r.dispositivo)
    if (error) onError('No se pudo guardar la marca de envío.')
    else await onCambio()
  }

  if (cargando) return <p className="text-white/60 text-sm">Cargando…</p>

  return (
    <div className="space-y-3">
      <div className="bg-neutral-900/95 border border-white/15 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">Pedir entrada para sacar fotos</p>
          <p className="text-white/60 text-xs max-w-[52ch]">
            Apagado: cualquiera con el link de la app puede sacar fotos. Prendido: cada persona activa su rollo con el
            código de su entrada, y solo si ya pasó por la puerta. {rollos.filter((r) => r.entrada).length} rollos
            activados hasta ahora.
          </p>
        </div>
        <button
          onClick={cambiarExige}
          disabled={exige === null}
          aria-pressed={exige === true}
          className={`px-3 py-1.5 rounded-xl text-sm border transition-colors disabled:opacity-40 ${
            exige ? 'bg-white text-black border-white font-medium' : 'border-white/30 text-white/80 hover:text-white'
          }`}
        >
          {exige === null ? '…' : exige ? 'Prendido · apagar' : 'Apagado · prender'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-white/60 text-sm">
          {filas.length} rollos · {rollos.filter((r) => r.contacto).length} dejaron su mail ·{' '}
          {rollos.filter((r) => r.enviado_at).length} enviados
        </p>
        <button
          onClick={() => setSoloConMail((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
            soloConMail ? 'border-terra-400 text-terra-400' : 'border-white/20 text-white/60 hover:text-white'
          }`}
        >
          Solo con mail
        </button>
      </div>

      {filas.length === 0 ? (
        <div className="bg-black/40 border border-white/20 rounded-2xl p-8 text-center">
          <p className="text-white/60 text-sm">No hay rollos en esta vista.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filas.map((r) => {
            const t = resumen(porRollo.get(r.dispositivo) ?? [])
            return (
              <li key={r.dispositivo} className="bg-black/40 border border-white/20 rounded-2xl p-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-white font-semibold">Rollo Nº {r.numero}</p>
                  <p className="text-white/60 text-xs">
                    {t.total} {t.total === 1 ? 'foto' : 'fotos'} · {t.publicar} para publicar · {t.descartadas} no ·{' '}
                    {t.sinRevisar} sin revisar
                  </p>
                </div>
                {r.entrada && (
                  <p className="text-xs text-white/60">
                    Entrada de {r.entrada.name} · {r.entrada.email}
                  </p>
                )}
                <p className="text-sm text-white/80">{r.contacto ?? <span className="text-white/40">Sin mail</span>}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copiar(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-white text-black hover:bg-white/90"
                  >
                    {copiado === r.dispositivo ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                    {copiado === r.dispositivo ? 'Copiado' : 'Copiar link'}
                  </button>
                  <a
                    href={link(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-white/30 text-white/80 hover:text-white"
                  >
                    <ExternalLink size={16} aria-hidden />
                    Abrir
                  </a>
                  {destino(r) && (
                    <a
                      href={mailto(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-white/30 text-white/80 hover:text-white"
                    >
                      <Mail size={16} aria-hidden />
                      Enviar por mail
                    </a>
                  )}
                  <button
                    onClick={() => marcarEnviado(r)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border ${
                      r.enviado_at ? 'border-olive-500 text-olive-500' : 'border-white/30 text-white/60 hover:text-white'
                    }`}
                  >
                    <CheckCheck size={16} aria-hidden />
                    {r.enviado_at
                      ? `Enviado ${new Date(r.enviado_at).toLocaleDateString('es-AR')} · deshacer`
                      : 'Marcar enviado'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const dos = (n: number) => String(n).padStart(2, '0')

/** ISO → valor de <input type="datetime-local"> en la hora del navegador (no en UTC). */
function aInputLocal(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })

/**
 * Cuándo abre el revelado público de la app (blur_config.revelado_desde, migración 047).
 * Sin fecha = cerrado. Con fecha futura = programado. Con fecha pasada = abierto.
 * Abre las fotos marcadas "para publicar" a cualquiera que tenga la app, y a cada
 * persona el rollo de su teléfono.
 */
function ControlRevelado({ fotos, onError }: { fotos: Foto[]; onError: (m: string) => void }) {
  // undefined = todavía leyendo; null = sin fecha (cerrado)
  const [desde, setDesde] = useState<string | null | undefined>(undefined)
  const [entrada, setEntrada] = useState('')
  const [guardando, setGuardando] = useState(false)

  const leer = useCallback(async () => {
    const { data, error } = await supabase.from('blur_config').select('revelado_desde').eq('id', true).maybeSingle()
    if (error) {
      onError('No se pudo leer el estado del revelado.')
      return
    }
    const v = (data as { revelado_desde: string | null } | null)?.revelado_desde ?? null
    setDesde(v)
    setEntrada(v ? aInputLocal(v) : '')
  }, [onError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    leer()
  }, [leer])

  const guardar = async (valor: string | null) => {
    setGuardando(true)
    // .select() para saber si de verdad cambió una fila (con permisos de menos, un update no falla: no toca nada).
    const { data, error } = await supabase
      .from('blur_config')
      .update({ revelado_desde: valor })
      .eq('id', true)
      .select('revelado_desde')
      .maybeSingle()
    if (error || !data) onError('No se pudo guardar el cambio.')
    else {
      onError('')
      const v = (data as { revelado_desde: string | null }).revelado_desde
      setDesde(v)
      setEntrada(v ? aInputLocal(v) : '')
    }
    setGuardando(false)
  }

  const abrirAhora = () => {
    if (!window.confirm('¿Abrir el revelado ahora? Las fotos marcadas para publicar se ven en la app.')) return
    // 'now' lo resuelve la base: no depende del reloj de esta computadora.
    guardar('now')
  }

  const programar = () => {
    const fecha = new Date(entrada)
    if (Number.isNaN(fecha.getTime())) return
    if (fecha.getTime() <= Date.now() && !window.confirm('Esa fecha ya pasó: el revelado se abre ahora. ¿Seguir?')) return
    guardar(fecha.toISOString())
  }

  const cerrar = () => {
    if (!window.confirm('¿Cerrar el revelado? Las fotos dejan de verse en la app.')) return
    guardar(null)
  }

  if (desde === undefined) return <p className="text-white/60 text-sm">Cargando…</p>

  const abierto = desde !== null && new Date(desde).getTime() <= Date.now()
  const programado = desde !== null && !abierto
  const publicar = fotos.filter((f) => f.publicada).length
  const sinRevisar = fotos.filter((f) => !f.publicada && !f.descartada).length

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 ${
          abierto ? 'border-olive-500 bg-olive-600/10' : programado ? 'border-terra-400/60' : 'border-white/20 bg-black/40'
        }`}
      >
        <p className="text-white font-semibold">
          {abierto ? 'Abierto' : programado ? 'Programado' : 'Cerrado'}
        </p>
        <p className="text-white/70 text-sm mt-1">
          {abierto
            ? `Abierto desde el ${fechaLarga(desde)}. En la app se ven las ${publicar} fotos marcadas para publicar.`
            : programado
              ? `Se abre el ${fechaLarga(desde)}. Hasta entonces la app muestra la espera en el laboratorio.`
              : 'Nadie ve las fotos. La app muestra la espera en el laboratorio.'}
        </p>
      </div>

      {sinRevisar > 0 && (
        <p className="text-sm text-amber-300/90 border border-amber-300/30 rounded-2xl p-3">
          Hay {sinRevisar} {sinRevisar === 1 ? 'foto sin revisar' : 'fotos sin revisar'}. En la galería pública solo salen
          las que marcás para publicar, pero cada persona ve en su rollo personal todas las suyas menos las descartadas.
          Conviene terminar la revisión antes de abrir.
        </p>
      )}

      <div className="rounded-2xl border border-white/20 bg-black/40 p-4 space-y-3">
        <label htmlFor="revelado-fecha" className="block text-sm text-white/70">
          Fecha y hora de apertura
        </label>
        <input
          id="revelado-fecha"
          type="datetime-local"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          className="w-full sm:w-auto rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={programar}
            disabled={guardando || !entrada}
            className="px-3 py-1.5 rounded-xl text-sm bg-white text-black hover:bg-white/90 disabled:opacity-50"
          >
            Programar
          </button>
          <button
            onClick={abrirAhora}
            disabled={guardando || abierto}
            className="px-3 py-1.5 rounded-xl text-sm border border-olive-500 text-olive-500 disabled:opacity-40"
          >
            Abrir ahora
          </button>
          <button
            onClick={cerrar}
            disabled={guardando || desde === null}
            className="px-3 py-1.5 rounded-xl text-sm border border-white/30 text-white/80 hover:text-white disabled:opacity-40"
          >
            Cerrar
          </button>
        </div>
        <p className="text-xs text-white/50">
          Los links personales de la pestaña Rollos funcionan aunque esté cerrado: cuándo mandarlos lo decidís vos.
        </p>
      </div>
    </div>
  )
}
