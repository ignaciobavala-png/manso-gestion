import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CLARO, COSTA, GALPON, ID_LLEGADA, ISLA, MAPA_H, MAPA_W, MUELLES, RUTA_LANCHAS, TIPOS_PUNTO,
  type Pt, type Punto,
} from '../lib/mapa'

/**
 * Mapa recorrible de la isla: se arrastra con el dedo, se acerca con pellizco (o rueda),
 * los puntos son tocables y "Ir acá" marca un destino con una ruta punteada.
 *
 * Referencia de interfaz: el mapa de pausa de un videojuego (plano estilizado de bloques de
 * color, grilla fina, marcadores con ícono, destino marcado), sin nada más que eso.
 *
 * La geometría sale de lib/mapa.ts. Este componente no sabe cómo es la isla: cuando llegue el
 * dibujo real se cambian esos datos y esto sigue igual.
 */

const pts = (a: Pt[]) => a.map((p) => p.join(',')).join(' ')

/** Generador pseudoaleatorio con semilla: el mismo dibujo en cada carga. */
function azar(semilla: number) {
  let s = semilla >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Malla de triángulos con vértices corridos al azar: da el aspecto "low-poly" al recortarla con el contorno. */
function triangulos(x0: number, y0: number, x1: number, y1: number, celda: number, semilla: number, colores: string[]) {
  const r = azar(semilla)
  const cols = Math.ceil((x1 - x0) / celda) + 1
  const filas = Math.ceil((y1 - y0) / celda) + 1
  const P: Pt[][] = []
  for (let j = 0; j < filas; j++) {
    P[j] = []
    for (let i = 0; i < cols; i++) {
      const dx = i > 0 && i < cols - 1 ? (r() - 0.5) * celda * 0.7 : 0
      const dy = j > 0 && j < filas - 1 ? (r() - 0.5) * celda * 0.7 : 0
      P[j][i] = [x0 + i * celda + dx, y0 + j * celda + dy]
    }
  }
  const out: { puntos: string; relleno: string }[] = []
  const tri = (a: Pt, b: Pt, c: Pt) =>
    out.push({ puntos: pts([a, b, c]), relleno: colores[Math.floor(r() * colores.length)] })
  for (let j = 0; j < filas - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i], d = P[j + 1][i + 1]
      if (r() < 0.5) { tri(a, b, c); tri(b, d, c) } else { tri(a, b, d); tri(a, d, c) }
    }
  }
  return out
}

const VERDES = ['#003009', '#06380f', '#0c4417', '#005b15', '#0a3d12']
const OLIVAS = ['#1d4a20', '#285628', '#31622e', '#245224']

/** El dibujo. Memoizado y sin props: mover o acercar el mapa no lo vuelve a renderizar. */
const Arte = memo(function Arte() {
  const isla = useMemo(() => triangulos(480, 240, 1140, 780, 46, 7, VERDES), [])
  const costa = useMemo(() => triangulos(0, 0, 330, 1000, 50, 3, OLIVAS), [])
  const olas = useMemo(() => {
    const r = azar(11)
    return Array.from({ length: 70 }, () => `M ${(r() * MAPA_W).toFixed(0)} ${(r() * MAPA_H).toFixed(0)} q 10 -6 20 0 t 20 0`)
  }, [])
  const grilla = useMemo(() => {
    let d = ''
    for (let x = 100; x < MAPA_W; x += 100) d += `M ${x} 0 V ${MAPA_H} `
    for (let y = 100; y < MAPA_H; y += 100) d += `M 0 ${y} H ${MAPA_W} `
    return d
  }, [])
  const linea = { vectorEffect: 'non-scaling-stroke' as const }

  return (
    <svg width={MAPA_W} height={MAPA_H} viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} style={{ display: 'block' }} aria-hidden>
      <defs>
        <clipPath id="clip-isla"><polygon points={pts(ISLA)} /></clipPath>
        <clipPath id="clip-costa"><polygon points={pts(COSTA)} /></clipPath>
      </defs>

      <rect width={MAPA_W} height={MAPA_H} fill="#dcdcd2" />
      <path d={grilla} stroke="#1a1a1a" strokeOpacity=".07" strokeWidth="1" fill="none" {...linea} />
      {olas.map((d, i) => (
        <path key={i} d={d} stroke="#1a1a1a" strokeOpacity=".12" strokeWidth="1.2" fill="none" {...linea} />
      ))}

      {/* Espuma de la orilla, debajo de la tierra. */}
      <polygon points={pts(ISLA)} fill="#f2f2ea" stroke="#f2f2ea" strokeWidth="16" strokeLinejoin="round" />
      <polygon points={pts(COSTA)} fill="#f2f2ea" stroke="#f2f2ea" strokeWidth="16" strokeLinejoin="round" />

      <g clipPath="url(#clip-costa)">
        {costa.map((t, i) => <polygon key={i} points={t.puntos} fill={t.relleno} stroke={t.relleno} strokeWidth=".6" />)}
      </g>
      <g clipPath="url(#clip-isla)">
        {isla.map((t, i) => <polygon key={i} points={t.puntos} fill={t.relleno} stroke={t.relleno} strokeWidth=".6" />)}
      </g>
      <polygon points={pts(ISLA)} fill="none" stroke="#1a1a1a" strokeOpacity=".4" strokeWidth="1.5" {...linea} />
      <polygon points={pts(COSTA)} fill="none" stroke="#1a1a1a" strokeOpacity=".4" strokeWidth="1.5" {...linea} />

      <polygon points={pts(CLARO)} fill="#e8dca9" stroke="#fffcdc" strokeOpacity=".8" strokeWidth="2" strokeLinejoin="round" {...linea} />
      <polygon points={pts(GALPON)} fill="#bdbdb2" stroke="#1a1a1a" strokeOpacity=".4" strokeWidth="1" {...linea} />
      {MUELLES.map((m, i) => <polygon key={i} points={pts(m)} fill="#1a1a1a" />)}

      {/* Las lanchas, de muelle a muelle. */}
      <path d={RUTA_LANCHAS} fill="none" stroke="#f65200" strokeWidth="3" strokeDasharray="8 8" strokeLinecap="round" {...linea} />

      <text x="120" y="520" textAnchor="middle" transform="rotate(-90 120 520)" fill="#fffcdc" fillOpacity=".6"
        fontFamily="Space Mono, monospace" fontSize="30" letterSpacing="12">SAN FERNANDO</text>
    </svg>
  )
})

interface Vista { s: number; x: number; y: number }

const ZOOM_MAX = 6 // veces el zoom mínimo

interface Props {
  puntos: Punto[]
  seleccionado: string | null
  onSelect: (id: string | null) => void
  destino: string | null
  /** Se dibuja encima del mapa (la ficha del punto, avisos). Debe llevar `data-ignora`. */
  children?: ReactNode
}

export function MapaIsla({ puntos, seleccionado, onSelect, destino, children }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [vista, setVista] = useState<Vista>({ s: 0.5, x: 0, y: 0 })
  const iniciado = useRef(false)
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const arrastro = useRef(false)

  /** Que el mapa siempre cubra la caja: sin bordes vacíos ni zoom fuera de rango. */
  const acotar = useCallback((v: Vista, w: number, h: number): Vista => {
    const min = Math.max(w / MAPA_W, h / MAPA_H)
    const s = Math.min(Math.max(v.s, min), min * ZOOM_MAX)
    return {
      s,
      x: Math.min(0, Math.max(w - MAPA_W * s, v.x)),
      y: Math.min(0, Math.max(h - MAPA_H * s, v.y)),
    }
  }, [])

  const centrada = useCallback((w: number, h: number) => {
    const min = Math.max(w / MAPA_W, h / MAPA_H)
    // La isla entera a la vista, centrada en ella y no en el mapa.
    return acotar({ s: min * 1.15, x: w / 2 - 800 * min * 1.15, y: h / 2 - 500 * min * 1.15 }, w, h)
  }, [acotar])

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const medir = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      setTam({ w, h })
      // Se lee antes: el updater corre después y vería la marca ya cambiada.
      const primera = !iniciado.current
      setVista((v) => (primera ? centrada(w, h) : acotar(v, w, h)))
      if (w && h) iniciado.current = true
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [acotar, centrada])

  /** Acerca/aleja conservando fijo el punto (cx, cy) de la caja. */
  const zoomEn = useCallback((v: Vista, factor: number, cx: number, cy: number, w: number, h: number): Vista => {
    const min = Math.max(w / MAPA_W, h / MAPA_H)
    const s = Math.min(Math.max(v.s * factor, min), min * ZOOM_MAX)
    const f = s / v.s
    return acotar({ s, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }, w, h)
  }, [acotar])

  // La rueda necesita un listener no pasivo para poder frenar el scroll de la página.
  useEffect(() => {
    const el = caja.current
    if (!el) return
    const rueda = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setVista((v) => zoomEn(v, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, r.width, r.height))
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => el.removeEventListener('wheel', rueda)
  }, [zoomEn])

  const bajar = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-ignora]')) return
    caja.current?.setPointerCapture(e.pointerId)
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    arrastro.current = false
  }

  const mover = (e: React.PointerEvent) => {
    const previo = punteros.current.get(e.pointerId)
    if (!previo) return
    const antes = [...punteros.current.values()].map((p) => ({ ...p }))
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ahora = [...punteros.current.values()]
    const r = caja.current!.getBoundingClientRect()

    if (ahora.length === 1) {
      const dx = e.clientX - previo.x
      const dy = e.clientY - previo.y
      if (Math.abs(dx) + Math.abs(dy) > 0) arrastro.current = arrastro.current || Math.abs(dx) + Math.abs(dy) > 2
      setVista((v) => acotar({ ...v, x: v.x + dx, y: v.y + dy }, r.width, r.height))
    } else {
      const [a0, b0] = antes
      const [a1, b1] = ahora
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1
      const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
      const c0 = { x: (a0.x + b0.x) / 2 - r.left, y: (a0.y + b0.y) / 2 - r.top }
      const c1 = { x: (a1.x + b1.x) / 2 - r.left, y: (a1.y + b1.y) / 2 - r.top }
      arrastro.current = true
      setVista((v) => {
        const z = zoomEn(v, d1 / d0, c0.x, c0.y, r.width, r.height)
        return acotar({ ...z, x: z.x + (c1.x - c0.x), y: z.y + (c1.y - c0.y) }, r.width, r.height)
      })
    }
  }

  const soltar = (e: React.PointerEvent) => {
    if (!punteros.current.delete(e.pointerId)) return
    // Un toque sobre el mapa vacío cierra la ficha.
    if (punteros.current.size === 0 && !arrastro.current) onSelect(null)
  }

  const llegada = puntos.find((p) => p.id === ID_LLEGADA)
  const meta = destino ? puntos.find((p) => p.id === destino) : undefined
  const hayRuta = !!(llegada && meta && meta.id !== ID_LLEGADA && meta.tipo !== 'muelle')

  const zoomBoton = (factor: number) =>
    setVista((v) => zoomEn(v, factor, tam.w / 2, tam.h / 2, tam.w, tam.h))

  const CTL =
    'flex h-10 w-10 items-center justify-center border border-[#1a1a1a] bg-[#eaeaea] font-mono text-lg font-bold text-[#1a1a1a] active:bg-[#fffcdc]'

  return (
    <div
      ref={caja}
      onPointerDown={bajar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      className="relative h-[min(68svh,34rem)] w-full cursor-grab touch-none select-none overflow-hidden border border-linea bg-[#dcdcd2] active:cursor-grabbing"
      role="application"
      aria-label="Mapa de la isla. Arrastrá para recorrerlo y pellizcá para acercar."
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: MAPA_W, height: MAPA_H,
          transformOrigin: '0 0', transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`,
        }}
      >
        <Arte />
        {hayRuta && llegada && meta && (
          <svg width={MAPA_W} height={MAPA_H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
            <line
              x1={llegada.x} y1={llegada.y} x2={meta.x} y2={meta.y}
              stroke="#ffa7fe" strokeWidth="4" strokeDasharray="10 9" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" className="mapa-ruta"
            />
          </svg>
        )}
      </div>

      {/* Marcadores: HTML encima, para que midan lo mismo con cualquier zoom y sean fáciles de tocar. */}
      {tam.w > 0 &&
        puntos.map((p) => {
          const px = p.x * vista.s + vista.x
          const py = p.y * vista.s + vista.y
          if (px < -30 || py < -30 || px > tam.w + 30 || py > tam.h + 30) return null
          const marca = TIPOS_PUNTO.find((t) => t.id === p.tipo)?.marca ?? '•'
          const fuerte = p.tipo === 'escenario' || p.tipo === 'charlas'
          const activo = seleccionado === p.id
          const esMeta = destino === p.id
          return (
            <button
              key={p.id}
              data-ignora
              onClick={() => onSelect(activo ? null : p.id)}
              aria-label={p.nombre}
              aria-pressed={activo}
              style={{ left: px, top: py }}
              className={`absolute z-10 flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 px-1.5 font-mono text-[11px] font-bold leading-none transition-transform ${
                fuerte ? 'border-[#1a1a1a] bg-[#f65200] text-[#1a1a1a]' : 'border-[#1a1a1a] bg-[#fffcdc] text-[#1a1a1a]'
              } ${activo ? 'scale-125 ring-2 ring-[#fffcdc] ring-offset-2 ring-offset-[#1a1a1a]' : ''} ${esMeta ? 'mapa-meta' : ''}`}
            >
              {marca}
              {(fuerte || activo || esMeta) && (
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[#fffcdc]">
                  {p.nombre}
                </span>
              )}
            </button>
          )
        })}

      <div data-ignora className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
        <button type="button" className={CTL} onClick={() => zoomBoton(1.5)} aria-label="Acercar">+</button>
        <button type="button" className={CTL} onClick={() => zoomBoton(1 / 1.5)} aria-label="Alejar">−</button>
        <button type="button" className={`${CTL} text-[11px]`} onClick={() => setVista(centrada(tam.w, tam.h))} aria-label="Volver a centrar">◎</button>
      </div>

      {children}
    </div>
  )
}
