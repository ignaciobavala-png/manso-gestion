import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * Carta de la Barra de BLUR: lo que se ve en la webapp (pestaña Barra). Acá se
 * crean las bebidas y la comida, se cargan los precios y se apagan los que no
 * hay. Se guarda en blur_carta_productos (migración 050); la webapp lee sólo
 * los activos con la anon key.
 */

interface Producto {
  id: string
  nombre: string
  categoria: string
  descripcion: string | null
  etiqueta: string | null
  vacante: boolean
  precio: number | null
  foto: string | null
  orden: number
  activo: boolean
}

type Borrador = {
  id: string | null
  nombre: string
  categoria: string
  descripcion: string
  etiqueta: string
  vacante: boolean
  precio: string
  orden: string
  activo: boolean
}

const VIDRIO = 'bg-neutral-900/95 backdrop-blur-md border border-white/15 shadow-lg shadow-black/40'
const CAMPO = 'w-full px-3 py-2 rounded-xl bg-neutral-800 border border-white/25 text-white text-sm outline-none focus:border-white/60'

const CATEGORIAS_SUGERIDAS = ['Los que más salen', 'De autor', 'Cervezas', 'Sin alcohol', 'Agua y gaseosas', 'Comida', 'Otros']

const vacio = (): Borrador => ({
  id: null,
  nombre: '',
  categoria: CATEGORIAS_SUGERIDAS[0],
  descripcion: '',
  etiqueta: '',
  vacante: false,
  precio: '',
  orden: '0',
  activo: true,
})

/** Precio escrito como en Argentina: "1500", "1.500" o "1500,50". Vacío = sin precio. */
function parsePrecio(texto: string): number | null | 'invalido' {
  const t = texto.trim()
  if (!t) return null
  const normal = t.replace(/\./g, '').replace(',', '.')
  const n = Number(normal)
  if (!Number.isFinite(n) || n < 0) return 'invalido'
  return Math.round(n * 100) / 100
}

const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function Barra() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  /** Categorías plegadas: la lista de la carta no se hace interminable al hacer scroll. */
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())

  const cargar = async () => {
    const { data, error: e } = await supabase
      .from('blur_carta_productos')
      .select('id, nombre, categoria, descripcion, etiqueta, vacante, precio, foto, orden, activo')
      .order('categoria')
      .order('orden')
      .order('nombre')
    if (e) {
      setError('No se pudo leer la carta.')
    } else {
      setError('')
      setProductos((data ?? []) as Producto[])
    }
    setCargando(false)
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      await cargar()
      if (!vivo) return
    })()
    return () => {
      vivo = false
    }
  }, [])

  const categorias = useMemo(() => {
    const set = new Set([...CATEGORIAS_SUGERIDAS, ...productos.map((p) => p.categoria)])
    return [...set]
  }, [productos])

  const porCategoria = useMemo(() => {
    const m = new Map<string, Producto[]>()
    for (const p of productos) m.set(p.categoria, [...(m.get(p.categoria) ?? []), p])
    return [...m.entries()]
  }, [productos])

  const abrirNuevo = () => {
    setAviso('')
    setBorrador(vacio())
  }

  const abrirEdicion = (p: Producto) => {
    setAviso('')
    setBorrador({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      descripcion: p.descripcion ?? '',
      etiqueta: p.etiqueta ?? '',
      vacante: p.vacante,
      precio: p.precio === null ? '' : String(p.precio).replace('.', ','),
      orden: String(p.orden),
      activo: p.activo,
    })
  }

  const guardar = async () => {
    if (!borrador) return
    const nombre = borrador.nombre.trim()
    const categoria = borrador.categoria.trim()
    if (!nombre || !categoria) {
      setAviso('Falta el nombre o la categoría.')
      return
    }
    const precio = parsePrecio(borrador.precio)
    if (precio === 'invalido') {
      setAviso('El precio no es válido. Ejemplo: 4500 o 4.500.')
      return
    }
    const orden = Number.parseInt(borrador.orden || '0', 10)
    if (!Number.isFinite(orden)) {
      setAviso('El orden tiene que ser un número.')
      return
    }

    const fila = {
      nombre,
      categoria,
      descripcion: borrador.descripcion.trim() || null,
      etiqueta: borrador.etiqueta.trim() || null,
      vacante: borrador.vacante,
      precio,
      orden,
      activo: borrador.activo,
    }

    setGuardando(true)
    const res = borrador.id
      ? await supabase.from('blur_carta_productos').update(fila).eq('id', borrador.id)
      : await supabase.from('blur_carta_productos').insert(fila)
    setGuardando(false)

    if (res.error) {
      setAviso(`No se pudo guardar: ${res.error.message}`)
      return
    }
    setBorrador(null)
    setAviso(borrador.id ? 'Producto actualizado.' : 'Producto creado.')
    await cargar()
  }

  const alternarActivo = async (p: Producto) => {
    const { error: e } = await supabase.from('blur_carta_productos').update({ activo: !p.activo }).eq('id', p.id)
    if (e) {
      setAviso(`No se pudo cambiar: ${e.message}`)
      return
    }
    setProductos((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo: !p.activo } : x)))
  }

  const borrar = async (p: Producto) => {
    if (!window.confirm(`¿Borrar "${p.nombre}" de la carta? Si solo querés ocultarlo, apagalo en vez de borrarlo.`)) return
    const { error: e } = await supabase.from('blur_carta_productos').delete().eq('id', p.id)
    if (e) {
      setAviso(`No se pudo borrar: ${e.message}`)
      return
    }
    setAviso(`"${p.nombre}" borrado.`)
    await cargar()
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-5xl mx-auto w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-white font-bold text-xl">Carta de la Barra</h1>
          <p className="text-white/60 text-sm">Lo que se ve en la webapp BLUR. Sin precio, el producto se muestra pero no se puede pedir.</p>
        </div>
        <div className="flex gap-2">
          {porCategoria.length > 1 && (
            <button
              onClick={() => setPlegadas(plegadas.size === porCategoria.length ? new Set() : new Set(porCategoria.map(([c]) => c)))}
              className="px-3 py-2 rounded-xl border border-white/25 text-white/80 text-sm"
            >
              {plegadas.size === porCategoria.length ? 'Desplegar todas' : 'Plegar todas'}
            </button>
          )}
          <button onClick={abrirNuevo} className="px-3 py-2 rounded-xl bg-white text-black text-sm font-medium">
            + Nuevo producto
          </button>
        </div>
      </div>

      {error && <p className="text-red-200 text-sm">{error}</p>}
      {aviso && <p className="text-sm text-white/80 rounded-xl px-3 py-2 border border-white/20 bg-white/5">{aviso}</p>}

      {borrador && (
        <div className={`${VIDRIO} rounded-2xl p-4 space-y-3`}>
          <p className="text-white font-semibold">{borrador.id ? 'Editar producto' : 'Nuevo producto'}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-white/60">Nombre *</span>
              <input className={CAMPO} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60">Categoría *</span>
              <input
                className={CAMPO}
                list="blur-categorias"
                value={borrador.categoria}
                onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })}
              />
              <datalist id="blur-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-white/60">Qué lleva</span>
              <input className={CAMPO} value={borrador.descripcion} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60">Precio (ARS)</span>
              <input
                className={CAMPO}
                inputMode="decimal"
                placeholder="Vacío = sin precio"
                value={borrador.precio}
                onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60">Orden (más chico, primero)</span>
              <input
                className={CAMPO}
                inputMode="numeric"
                value={borrador.orden}
                onChange={(e) => setBorrador({ ...borrador, orden: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60">Sello (opcional, ej. "De la casa")</span>
              <input className={CAMPO} value={borrador.etiqueta} onChange={(e) => setBorrador({ ...borrador, etiqueta: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
                Visible en la webapp
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={borrador.vacante} onChange={(e) => setBorrador({ ...borrador, vacante: e.target.checked })} />
                Lugar reservado (sin pedido)
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setBorrador(null)} className="px-3 py-2 rounded-xl border border-white/25 text-white/80 text-sm">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-3 py-2 rounded-xl bg-white text-black text-sm font-medium disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-white/70 text-sm py-10 text-center">Cargando…</p>
      ) : productos.length === 0 ? (
        <p className="text-white/70 text-sm py-10 text-center">Todavía no hay productos cargados. Con la carta vacía, la webapp muestra la carta de maqueta.</p>
      ) : (
        <div className="space-y-3">
          {porCategoria.map(([cat, lista]) => (
            <section key={cat} className={`${VIDRIO} rounded-2xl overflow-hidden`}>
              <button
                onClick={() =>
                  setPlegadas((prev) => {
                    const n = new Set(prev)
                    if (n.has(cat)) n.delete(cat)
                    else n.add(cat)
                    return n
                  })
                }
                aria-expanded={!plegadas.has(cat)}
                className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left border-b border-white/10"
              >
                <span className="text-white font-semibold text-sm">{cat}</span>
                <span className="text-xs text-white/60">
                  {lista.length} {lista.length === 1 ? 'producto' : 'productos'} · {plegadas.has(cat) ? 'Desplegar' : 'Plegar'}
                </span>
              </button>
              {!plegadas.has(cat) && <ul className="divide-y divide-white/10">
                {lista.map((p) => (
                  <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-[15px] break-words">
                        {p.nombre}
                        {p.etiqueta && <span className="ml-2 text-[11px] text-terra-400">{p.etiqueta}</span>}
                        {p.vacante && <span className="ml-2 text-[11px] text-white/50">reservado</span>}
                      </p>
                      {p.descripcion && <p className="text-xs text-white/55 truncate">{p.descripcion}</p>}
                    </div>
                    <p className="font-mono text-sm text-white/90 w-28 text-right">{p.precio === null ? 'sin precio' : pesos(p.precio)}</p>
                    <button
                      onClick={() => alternarActivo(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs border ${p.activo ? 'border-emerald-400/40 text-emerald-200' : 'border-white/25 text-white/50'}`}
                    >
                      {p.activo ? 'Visible' : 'Oculto'}
                    </button>
                    <button onClick={() => abrirEdicion(p)} className="px-2.5 py-1 rounded-lg text-xs border border-white/25 text-white/80">
                      Editar
                    </button>
                    <button onClick={() => borrar(p)} className="px-2.5 py-1 rounded-lg text-xs border border-red-400/40 text-red-200">
                      Borrar
                    </button>
                  </li>
                ))}
              </ul>}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
