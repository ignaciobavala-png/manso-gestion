import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ARBOLES, ARENA, CAMINOS, COSTA, EDEN, ESTRUCTURAS, ETIQUETAS, GENTE, ID_LLEGADA, MAPA_H, MAPA_W, MARGEN, PREDIO_H, PREDIO_W, TIERRA, TIPOS_PUNTO,
  type Grupo3D, type Prim, type Pt, type Punto,
} from '../lib/mapa'

/**
 * Mapa recorrible del predio: se arrastra con el dedo, se acerca con pellizco (o rueda),
 * los puntos son tocables y "Ir acá" marca un destino con una ruta punteada.
 *
 * Referencia visual: el mapa 2D de un GTA clásico (Vice City): dibujo plano de bloques de color,
 * costa con contorno grueso, caminos con borde, nombres de zona, marcadores con ícono, destino
 * marcado y un radar redondo. Con los colores de la página; no se usa nada del juego.
 *
 * La geometría es la real del predio (la del mapa 3D de Ana) y sale de lib/mapa.ts.
 */

const pts = (a: Pt[]) => a.map((p) => p.join(',')).join(' ')

/** Curva suave (Catmull-Rom) por los puntos de un camino. */
function suave(p: Pt[]) {
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/** Azar determinista por celda: el mismo dibujo en cada carga. */
const az = (i: number, j: number, k: number) => {
  const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
  return v - Math.floor(v)
}

/**
 * Malla de triángulos con los vértices corridos al azar: da el aspecto "low poly" de los mapas
 * de relieve. Cada triángulo lleva un tono apenas distinto; los que tienen `b` brillan despacio.
 */
const CELDA = 64
const FACETAS = (() => {
  const nx = Math.ceil(MAPA_W / CELDA) + 1, ny = Math.ceil(MAPA_H / CELDA) + 1
  const v = (i: number, j: number): Pt => [i * CELDA + (az(i, j, 1) - 0.5) * CELDA * 0.7, j * CELDA + (az(i, j, 2) - 0.5) * CELDA * 0.7]
  const out: { d: string; a: number; b: number; k: number }[] = []
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1)
      ;([[a, b, c], [b, d, c]] as Pt[][]).forEach((t, k) => {
        const r = az(i, j, 3 + k)
        out.push({ d: `M${t[0]}L${t[1]}L${t[2]}Z`, a: r, b: az(i, j, 9 + k), k: Math.floor(az(i, j, 20 + k) * 5000) })
      })
    }
  return out
})()

const tierra = '#e6d9a6'
const tinta = '#1a1a1a'
const COPAS = ['#5f8131', '#7c9a3a', '#8aa34a', '#9fae3e', '#b9a63a', '#c7b84a']

function Forma({ p }: { p: Prim }) {
  const borde = p.borde ? { stroke: tinta, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const } : {}
  if (p.t === 'circ') {
    return (
      <ellipse
        cx={p.x} cy={p.z} rx={p.rx} ry={p.rz ?? p.rx} fill={p.hueco ? 'none' : p.c}
        transform={p.rot ? `rotate(${p.rot} ${p.x} ${p.z})` : undefined}
        {...(p.hueco ? { stroke: p.c, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const } : borde)}
      />
    )
  }
  return (
    <rect
      x={p.x - p.w / 2} y={p.z - p.d / 2} width={p.w} height={p.d} fill={p.c} fillOpacity={p.op}
      transform={p.rot ? `rotate(${p.rot} ${p.x} ${p.z})` : undefined} {...borde}
    />
  )
}

function Estructura({ g }: { g: Grupo3D }) {
  // Unidades de mundo: 1 = 10 de mapa. El Edén va girado 0,27 rad.
  const a = g.giro ? Math.cos(g.giro) * 10 : 10
  const b = g.giro ? -Math.sin(g.giro) * 10 : 0
  const c = g.giro ? Math.sin(g.giro) * 10 : 0
  return (
    <g transform={`matrix(${a} ${b} ${c} ${a} ${g.x} ${g.y})`}>
      {g.prims.map((p, i) => <Forma key={i} p={p} />)}
    </g>
  )
}

/**
 * El dibujo, plano como un mapa de juego: agua verde oscuro con olas, tierra clara con
 * contorno grueso y sombra, monte, caminos con borde, construcciones y rótulos.
 * Memoizado: mover o acercar el mapa no lo vuelve a renderizar. `id` evita ids repetidos
 * cuando se dibuja también en el radar; `liviano` omite el detalle fino (árboles, gente y
 * construcciones), que a escala de radar no se ve.
 */
const Arte = memo(function Arte({ id, liviano }: { id: string; liviano?: boolean }) {
  const linea = { vectorEffect: 'non-scaling-stroke' as const }
  const arboles = useMemo(() => ARBOLES.map((t, i) => ({ ...t, i })), [])

  return (
    <svg width={MAPA_W} height={MAPA_H} viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} style={{ display: 'block' }} aria-hidden>
      <defs>
        <pattern id={`olas-${id}`} width="46" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 q 11.5 -7 23 0 t 23 0" fill="none" stroke="#fffcdc" strokeOpacity=".16" strokeWidth="1.6" />
        </pattern>
        <clipPath id={`tierra-${id}`}><polygon points={pts(TIERRA)} /></clipPath>
        <clipPath id={`costa-${id}`}><polygon points={pts(COSTA)} /></clipPath>
      </defs>

      <rect width={MAPA_W} height={MAPA_H} fill="#003009" />
      {!liviano && (
        <g aria-hidden>
          {FACETAS.map((f, i) => (
            <path
              key={i} d={f.d} fill="#0a7a2c" fillOpacity={0.06 + f.a * 0.16}
              className={f.b > 0.9 ? 'mapa-brillo' : undefined} style={f.b > 0.9 ? { animationDelay: `${(f.k % 50) / 10}s` } : undefined}
            />
          ))}
        </g>
      )}
      <rect x="-46" width={MAPA_W + 46} height={MAPA_H} fill={`url(#olas-${id})`} className={liviano ? undefined : 'mapa-olas'} />

      {/* Sombra desplazada de la tierra, como el relieve de un mapa impreso. */}
      <g transform="translate(10 12)" fill="#000" fillOpacity=".4">
        <polygon points={pts(TIERRA)} />
        <polygon points={pts(COSTA)} />
      </g>

      <polygon points={pts(COSTA)} fill="#d4c68f" />
      <polygon points={pts(TIERRA)} fill={tierra} />

      {/* Facetas del relieve sobre la tierra y la costa. */}
      {!liviano && (
        <g clipPath={`url(#tierra-${id})`}>
          {FACETAS.map((f, i) => <path key={i} d={f.d} fill={f.a > 0.5 ? '#fff' : '#8a7a3a'} fillOpacity={Math.abs(f.a - 0.5) * 0.22} />)}
        </g>
      )}

      {/* Arena de las zonas abiertas. */}
      <g clipPath={`url(#tierra-${id})`} fill="#d9b878" fillOpacity=".75">
        {ARENA.map((e, i) => <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={`rotate(${e.rot} ${e.cx} ${e.cy})`} />)}
      </g>

      {/* Monte: los árboles del original, recortados a cada orilla. */}
      {!liviano &&
        (['tierra', 'costa'] as const).map((z) => (
          <g key={z} clipPath={`url(#${z}-${id})`} stroke="#003009" strokeWidth="1.5" strokeOpacity=".5">
            {arboles.map((t) => (t.costa === (z === 'costa') ? <circle key={t.i} cx={t.x} cy={t.y} r={t.r * 0.5} fill={t.k > 0.94 ? '#c98da0' : COPAS[Math.floor(t.k * 997) % COPAS.length]} /> : null))}
          </g>
        ))}

      {/* Caminos: borde oscuro y relleno naranja. Primero todos los bordes, así se funden en los cruces. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {CAMINOS.map((s, i) => <path key={`b${i}`} d={suave(s)} stroke={tinta} strokeWidth="15" />)}
        {CAMINOS.map((s, i) => <path key={`r${i}`} d={suave(s)} stroke="#f65200" strokeWidth="9" />)}
      </g>

      {!liviano && (
        <g fill="none" strokeLinecap="round" aria-hidden>
          {CAMINOS.map((c, i) => <path key={i} d={suave(c)} stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="2 26" className="mapa-flujo" />)}
        </g>
      )}

      {!liviano && (
        <>
          {GENTE.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#5a6070" fillOpacity=".6" />)}
          {ESTRUCTURAS.map((g) => <Estructura key={g.id} g={g} />)}
          <Estructura g={EDEN} />
        </>
      )}

      {/* Contorno grueso de la costa, por encima de todo lo de tierra. */}
      <polygon points={pts(TIERRA)} fill="none" stroke={tinta} strokeWidth="3.5" strokeLinejoin="round" {...linea} />
      <polygon points={pts(COSTA)} fill="none" stroke={tinta} strokeWidth="3.5" strokeLinejoin="round" {...linea} />

      {ETIQUETAS.map((e) => (
        <text
          key={e.texto} x={e.x} y={e.y} textAnchor="middle" fill="#fffcdc" fillOpacity={0.75}
          fontFamily="Space Mono, monospace" fontWeight="700" fontSize={e.tam} letterSpacing={12}
        >
          {e.texto}
        </text>
      ))}

      {/* Brújula y marca, en el agua. */}
      <g transform={`translate(${MARGEN + 1200} ${MARGEN + 1130})`} aria-hidden>
        <circle r="46" fill="none" stroke="#fffcdc" strokeOpacity=".7" strokeWidth="2.5" />
        <path d="M0 -38 L9 0 L0 8 L-9 0 Z" fill="#f65200" />
        <path d="M0 38 L9 0 L0 -8 L-9 0 Z" fill="#fffcdc" fillOpacity=".7" />
        <text y="-56" textAnchor="middle" fill="#fffcdc" fontFamily="Space Mono, monospace" fontWeight="700" fontSize="22">N</text>
      </g>
      <image href={`${import.meta.env.BASE_URL}marca/logo_1_b.svg`} x={MARGEN + 60} y={MARGEN + 1150} width="220" height="38" opacity=".9" />
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

  /** El mapa siempre cubre la caja: sin bordes vacíos ni zoom fuera de rango. */
  const acotar = useCallback((v: Vista, w: number, h: number): Vista => {
    const min = Math.max(w / MAPA_W, h / MAPA_H)
    const s = Math.min(Math.max(v.s, min), min * ZOOM_MAX)
    return {
      s,
      // Si el mapa es más chico que la caja en un eje, se centra; si es más grande, no deja bordes vacíos.
      x: MAPA_W * s <= w ? (w - MAPA_W * s) / 2 : Math.min(0, Math.max(w - MAPA_W * s, v.x)),
      y: MAPA_H * s <= h ? (h - MAPA_H * s) / 2 : Math.min(0, Math.max(h - MAPA_H * s, v.y)),
    }
  }, [])

  const centrada = useCallback((w: number, h: number) => {
    const min = Math.max(w / MAPA_W, h / MAPA_H)
    // Todo el predio a la vista.
    // El predio de Ana entero y centrado; el margen recreado queda a los costados si la caja es más ancha.
    const f = Math.max(min, Math.min(w / PREDIO_W, h / PREDIO_H))
    return acotar({ s: f, x: w / 2 - (MARGEN + PREDIO_W / 2) * f, y: h / 2 - (MARGEN + PREDIO_H / 2) * f }, w, h)
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
      className="relative aspect-[1280/1224] max-h-[82svh] w-full cursor-grab touch-none select-none overflow-hidden border border-linea bg-[#003009] active:cursor-grabbing"
      role="application"
      aria-label="Mapa del predio. Arrastrá para recorrerlo y pellizcá para acercar."
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
          const fuerte = p.grupo === 'zonas'
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
        <Arte id="r" liviano />
      </div>
      {puntos.filter((p) => p.tipo === 'escenario').map((p) => (
        <span key={p.id} style={origen(p.x, p.y)} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f65200] ring-1 ring-[#1a1a1a]" />
      ))}
      {/* El centro: hacia dónde se está mirando. */}
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[#1a1a1a] bg-[#fffcdc]" />
    </div>
  )
}
