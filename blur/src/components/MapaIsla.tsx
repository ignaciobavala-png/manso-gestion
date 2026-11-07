import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CLARO, COSTA, CUPULA, EDIFICIOS, ETIQUETAS, ID_LLEGADA, IMAGEN_BASE, ISLA, MAPA_H, MAPA_W, MUELLES,
  PUNTOS, RUTA_LANCHAS, SENDEROS, TIPOS_PUNTO, type Pt, type Punto,
} from '../lib/mapa'

/**
 * Mapa recorrible de la isla: se arrastra con el dedo, se acerca con pellizco (o rueda),
 * los puntos son tocables y "Ir acá" marca un destino con una ruta punteada.
 *
 * Referencia visual: el mapa 2D de un GTA clásico (Vice City): dibujo plano de bloques de color,
 * costa con contorno grueso, caminos con borde, nombres de zona, marcadores con ícono, destino
 * marcado y un radar redondo. Con los colores de la página; no se usa nada del juego.
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

function dentro(p: Pt, poly: Pt[]) {
  let en = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) en = !en
  }
  return en
}

function distSegmento(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/**
 * Manchas de monte: racimos de círculos en zonas libres (fuera del claro, de los caminos y de
 * los puntos). Con semilla fija, así que el monte no cambia entre cargas.
 */
function monte(zona: Pt[], limiteX: number, semilla: number, cuantos: number) {
  const r = azar(semilla)
  const xs = zona.map((p) => p[0]), ys = zona.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.min(Math.max(...xs), limiteX), Math.min(...ys), Math.max(...ys)]
  const libre = (p: Pt) =>
    dentro(p, zona) &&
    !dentro(p, CLARO) &&
    SENDEROS.every((s) => s.slice(1).every((q, k) => distSegmento(p, s[k], q) > 34)) &&
    PUNTOS.every((q) => Math.hypot(p[0] - q.x, p[1] - q.y) > 44)
  const manchas: { x: number; y: number; r: number }[][] = []
  for (let n = 0, intentos = 0; n < cuantos && intentos < 4000; intentos++) {
    const c: Pt = [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0)]
    if (!libre(c)) continue
    const racimo = Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({
      x: c[0] + (r() - 0.5) * 40, y: c[1] + (r() - 0.5) * 30, r: 13 + r() * 13,
    })).filter((q) => dentro([q.x, q.y], zona))
    if (racimo.length) { manchas.push(racimo); n++ }
  }
  return manchas
}

const tierra = '#e6d9a6'
const tinta = '#1a1a1a'
const camino = (pl: Pt[]) => 'M ' + pl.map((p) => p.join(' ')).join(' L ')

/**
 * El dibujo, plano como un mapa de juego: agua verde oscuro con olas, tierra gris claro con
 * contorno grueso y sombra, monte, caminos con borde, construcciones y nombres de zona.
 * Memoizado: mover o acercar el mapa no lo vuelve a renderizar. `id` evita ids repetidos
 * cuando se dibuja también en el radar.
 */
const Arte = memo(function Arte({ id }: { id: string }) {
  const montes = useMemo(() => [...monte(ISLA, 1200, 5, 30), ...monte(COSTA, 215, 9, 14)], [])
  const linea = { vectorEffect: 'non-scaling-stroke' as const }

  if (IMAGEN_BASE) {
    return (
      <svg width={MAPA_W} height={MAPA_H} viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} style={{ display: 'block' }} aria-hidden>
        <image href={IMAGEN_BASE} width={MAPA_W} height={MAPA_H} preserveAspectRatio="none" />
      </svg>
    )
  }

  return (
    <svg width={MAPA_W} height={MAPA_H} viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} style={{ display: 'block' }} aria-hidden>
      <defs>
        <pattern id={`olas-${id}`} width="46" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 q 11.5 -7 23 0 t 23 0" fill="none" stroke="#fffcdc" strokeOpacity=".16" strokeWidth="1.6" />
        </pattern>
        <clipPath id={`isla-${id}`}><polygon points={pts(ISLA)} /></clipPath>
        <clipPath id={`costa-${id}`}><polygon points={pts(COSTA)} /></clipPath>
      </defs>

      <rect width={MAPA_W} height={MAPA_H} fill="#003009" />
      <rect width={MAPA_W} height={MAPA_H} fill={`url(#olas-${id})`} />

      {/* Sombra desplazada de la tierra, como el relieve de un mapa impreso. */}
      <g transform="translate(10 12)" fill="#000" fillOpacity=".4">
        <polygon points={pts(ISLA)} />
        <polygon points={pts(COSTA)} />
      </g>

      <polygon points={pts(COSTA)} fill="#d4c68f" />
      <polygon points={pts(ISLA)} fill={tierra} />

      {/* Monte, recortado al contorno: nunca se sale al agua. */}
      <g clipPath={`url(#isla-${id})`}>{montes.slice(0, 30).map((m, i) => <Mancha key={i} m={m} />)}</g>
      <g clipPath={`url(#costa-${id})`}>{montes.slice(30).map((m, i) => <Mancha key={i} m={m} />)}</g>

      <polygon points={pts(CLARO)} fill="#fffcdc" stroke={tinta} strokeWidth="2" strokeLinejoin="round" {...linea} />

      {/* Caminos: borde oscuro y relleno naranja. Primero todos los bordes, así se funden en los cruces. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {SENDEROS.map((s, i) => <path key={`b${i}`} d={camino(s)} stroke={tinta} strokeWidth="13" />)}
        {SENDEROS.map((s, i) => <path key={`r${i}`} d={camino(s)} stroke="#f65200" strokeWidth="7" />)}
      </g>

      {EDIFICIOS.map((e, i) => <polygon key={i} points={pts(e.puntos)} fill={e.relleno} stroke={tinta} strokeWidth="2" {...linea} />)}
      <circle cx={CUPULA.x} cy={CUPULA.y} r={CUPULA.r} fill="#fffcdc" stroke={tinta} strokeWidth="2" {...linea} />
      {MUELLES.map((m, i) => <polygon key={i} points={pts(m)} fill={tinta} />)}

      {/* Contorno grueso de la costa, por encima de todo lo de tierra. */}
      <polygon points={pts(ISLA)} fill="none" stroke={tinta} strokeWidth="3.5" strokeLinejoin="round" {...linea} />
      <polygon points={pts(COSTA)} fill="none" stroke={tinta} strokeWidth="3.5" strokeLinejoin="round" {...linea} />

      {/* Las lanchas, de muelle a muelle. */}
      <path d={RUTA_LANCHAS} fill="none" stroke="#f65200" strokeWidth="4" strokeDasharray="9 9" strokeLinecap="round" {...linea} />

      {ETIQUETAS.map((e) => (
        <text
          key={e.texto} x={e.x} y={e.y} textAnchor="middle"
          transform={e.rot ? `rotate(${e.rot} ${e.x} ${e.y})` : undefined}
          fill={e.sobre === 'agua' ? '#fffcdc' : tinta} fillOpacity={e.sobre === 'agua' ? 0.75 : 0.5}
          fontFamily="Space Mono, monospace" fontWeight="700" fontSize={e.tam ?? 20} letterSpacing={e.tam && e.tam > 25 ? 12 : 6}
        >
          {e.texto}
        </text>
      ))}

      {/* Brújula y marca, en el agua. */}
      <g transform="translate(1290 120)" aria-hidden>
        <circle r="46" fill="none" stroke="#fffcdc" strokeOpacity=".7" strokeWidth="2.5" />
        <path d="M0 -38 L9 0 L0 8 L-9 0 Z" fill="#f65200" />
        <path d="M0 38 L9 0 L0 -8 L-9 0 Z" fill="#fffcdc" fillOpacity=".7" />
        <text y="-56" textAnchor="middle" fill="#fffcdc" fontFamily="Space Mono, monospace" fontWeight="700" fontSize="22">N</text>
      </g>
      <image href={`${import.meta.env.BASE_URL}marca/logo_1_b.svg`} x="1130" y="870" width="220" height="38" opacity=".9" />
    </svg>
  )
})

/** Un racimo de círculos de monte: contorno más oscuro, como las manchas de verde de un mapa de juego. */
function Mancha({ m }: { m: { x: number; y: number; r: number }[] }) {
  return (
    <g fill="#005b15" stroke="#003009" strokeWidth="3">
      {m.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} />)}
    </g>
  )
}

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
        <Arte id="p" />
        {hayRuta && llegada && meta && (
          <svg width={MAPA_W} height={MAPA_H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
            <line
              x1={llegada.x} y1={llegada.y} x2={meta.x} y2={meta.y}
              stroke="#1a1a1a" strokeWidth="9" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            />
            <line
              x1={llegada.x} y1={llegada.y} x2={meta.x} y2={meta.y}
              stroke="#ffa7fe" strokeWidth="5" strokeDasharray="10 9" strokeLinecap="round"
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

      <Radar vista={vista} tam={tam} puntos={puntos} />

      <div data-ignora className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
        <button type="button" className={CTL} onClick={() => zoomBoton(1.5)} aria-label="Acercar">+</button>
        <button type="button" className={CTL} onClick={() => zoomBoton(1 / 1.5)} aria-label="Alejar">−</button>
        <button type="button" className={`${CTL} text-[11px]`} onClick={() => setVista(centrada(tam.w, tam.h))} aria-label="Volver a centrar">◎</button>
      </div>

      {children}
    </div>
  )
}

const RADAR = 92 // px
const RADAR_ESCALA = 0.16 // px por unidad de mapa: muestra unas 570 unidades de ancho

/**
 * Radar redondo: la misma isla, a escala fija, centrada en lo que se está mirando. Se mueve
 * con el mapa y marca el centro, como el minimapa de un juego. Es solo una guía: no se toca.
 */
function Radar({ vista, tam, puntos }: { vista: Vista; tam: { w: number; h: number }; puntos: Punto[] }) {
  if (!tam.w) return null
  const cx = (tam.w / 2 - vista.x) / vista.s
  const cy = (tam.h / 2 - vista.y) / vista.s
  const k = RADAR_ESCALA
  const origen = (x: number, y: number) => ({ left: RADAR / 2 + (x - cx) * k, top: RADAR / 2 + (y - cy) * k })
  return (
    <div
      data-ignora aria-hidden
      style={{ width: RADAR, height: RADAR }}
      className="pointer-events-none absolute bottom-auto left-3 top-3 z-20 overflow-hidden rounded-full border-[3px] border-[#1a1a1a] bg-[#003009] shadow-[0_0_0_2px_#fffcdc]"
    >
      <div
        style={{
          position: 'absolute', width: MAPA_W, height: MAPA_H, transformOrigin: '0 0',
          transform: `translate(${RADAR / 2 - cx * k}px, ${RADAR / 2 - cy * k}px) scale(${k})`,
        }}
      >
        <Arte id="r" />
      </div>
      {puntos.filter((p) => p.tipo === 'escenario').map((p) => (
        <span key={p.id} style={origen(p.x, p.y)} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f65200] ring-1 ring-[#1a1a1a]" />
      ))}
      {/* El centro: hacia dónde se está mirando. */}
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[#1a1a1a] bg-[#fffcdc]" />
    </div>
  )
}
