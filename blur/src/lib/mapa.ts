/**
 * Geometría REAL del predio, extraída del mapa 3D «Mapa Delta Rica» que dejó Ana (detalle completo
 * en `blur/docs/mapa-delta-rica-extraccion.md`).
 *
 * El original parte de un plano de 1280 × 720 y lo pasa al mundo 3D con `x·0,1` y `y·0,17`: el
 * mundo es casi cuadrado (128 × 122). Acá se dibuja en proporción de mundo, que es lo que se ve
 * en el 3D desde arriba: **1 unidad de mundo = 10 unidades de mapa**, así un domo redondo sale
 * redondo y las distancias entre lugares son las del 3D. `plano(x, y)` convierte una coordenada
 * del plano original a coordenada de mapa.
 *
 * Todo lo que se dibuja sale de este archivo: MapaIsla no sabe cómo es el predio.
 */

/** El predio de Ana ocupa 1280 × 1224; alrededor hay un margen recreado (monte, tierra y agua) para que el mapa siempre llene la caja. */
export const PREDIO_W = 1280
export const PREDIO_H = 1224
export const MARGEN = 300
export const MAPA_W = PREDIO_W + MARGEN * 2
export const MAPA_H = PREDIO_H + MARGEN * 2

export type Pt = [number, number]

const SX = 0.1
const SZ = 0.17
/** Del plano 1280 × 720 del original a coordenadas de mapa. */
export const plano = (x: number, y: number): Pt => [x + MARGEN, 612 + MARGEN + (y - 360) * (SZ / SX)]
const poli = (p: Pt[]): Pt[] => p.map(([x, y]) => plano(x, y))

/** Tierra firme: el predio. Más allá del recuadro de Ana (arriba y a la derecha) la costa sigue recreada. */
const TIERRA_PLANO: Pt[] = [
  [580, -260], [1700, -260], [1700, 575], [1150, 600], [1000, 612], [860, 628], [720, 630], [590, 628], [470, 612],
  [360, 585], [260, 550], [195, 505], [170, 445], [168, 380], [192, 322], [250, 262], [318, 190], [395, 110], [455, 40],
]
export const TIERRA: Pt[] = poli(TIERRA_PLANO)

/** La otra orilla, arriba a la izquierda. Entre las dos queda el canal. */
const COSTA_PLANO: Pt[] = [[-400, -260], [480, -260], [430, -60], [380, 10], [300, 95], [205, 180], [110, 262], [30, 320], [-400, 345]]
export const COSTA: Pt[] = poli(COSTA_PLANO)

/** Manchas de arena: elipses. */
export const ARENA: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [
  [690, 330, 215, 95, 0.05], [800, 560, 250, 62, 0], [1040, 600, 120, 28, 0], [650, 520, 90, 40, 0],
].map(([x, y, a, b, rot]) => {
  const [cx, cy] = plano(x, y)
  return { cx, cy, rx: a, ry: b * (SZ / SX), rot: -rot * (180 / Math.PI) }
})

/** Caminos: curvas suaves por estos puntos. */
export const CAMINOS: Pt[][] = [
  [[190, 300], [260, 300], [330, 330], [420, 335], [520, 330]],
  [[520, 330], [540, 280], [520, 230], [540, 170], [560, 120], [600, 105]],
  [[860, 240], [930, 235], [990, 170], [1000, 110], [990, 60]],
  [[1000, 110], [1060, 240], [1120, 380], [1170, 480], [1195, 560]],
  [[300, 520], [260, 470], [250, 410], [300, 350]],
].map((c) => poli(c as Pt[]))

/** Rótulo de agua. */
export const ETIQUETAS: { texto: string; x: number; y: number; tam: number }[] = [
  { texto: 'RÍO LUJÁN', ...(([x, y]) => ({ x, y }))(plano(1060, 690)), tam: 30 },
]

// ───────────────────────── Lugares ─────────────────────────

export type TipoPunto = 'escenario' | 'zona' | 'charlas' | 'barra' | 'bano' | 'muelle' | 'salida'
export type Grupo = 'zonas' | 'barras' | 'muelles'

export const GRUPOS: { id: Grupo; nombre: string }[] = [
  { id: 'zonas', nombre: 'Zonas' },
  { id: 'barras', nombre: 'Barras y baños' },
  { id: 'muelles', nombre: 'Muelles y salidas' },
]

export const TIPOS_PUNTO: { id: TipoPunto; nombre: string; marca: string }[] = [
  { id: 'escenario', nombre: 'Pista principal', marca: 'E' },
  { id: 'zona', nombre: 'Zonas', marca: 'Z' },
  { id: 'charlas', nombre: 'Panel de charlas', marca: 'S' },
  { id: 'barra', nombre: 'Barras', marca: 'B' },
  { id: 'bano', nombre: 'Baños', marca: 'WC' },
  { id: 'muelle', nombre: 'Muelles', marca: 'M' },
  { id: 'salida', nombre: 'Salidas', marca: '→' },
]

export interface Punto {
  id: string
  tipo: TipoPunto
  grupo: Grupo
  nombre: string
  /** Coordenadas de mapa (ya convertidas del plano original). */
  x: number
  y: number
  info?: string
}

/** Muelle por el que se llega: desde ahí sale la ruta de "Ir acá". (A confirmar con Ana.) */
export const ID_LLEGADA = 'm1'

// Nombres literales como los escribió Ana: no se cambia la caja.
const L: [string, TipoPunto, Grupo, string, number, number, string?][] = [
  ['sv', 'zona', 'zonas', 'sound & vision', 690, 335],
  ['eden', 'escenario', 'zonas', 'El edén', 1172, 235, 'Pista principal · cabina con neón · sistema Funktion-One · unas 650 personas'],
  ['chill', 'zona', 'zonas', 'Chill & microdancing', 425, 430],
  ['inst', 'zona', 'zonas', 'instalación artística', 800, 550],
  ['panel', 'charlas', 'zonas', 'Panel de charlas', 365, 247],
  ['carpa', 'zona', 'zonas', 'Carpa Beduina', 640, 195],
  ['domo', 'zona', 'zonas', 'Domo', 902, 178],
  ['merc', 'zona', 'zonas', 'Mercadito', 848, 288],
  ['chir', 'barra', 'barras', 'Chiringo · Bar', 522, 250],
  ['barra', 'barra', 'barras', 'Barra 2 BLUR', 848, 97],
  ['banos', 'bano', 'barras', 'Baños', 648, 100],
  ['m1', 'muelle', 'muelles', 'Muelle 1', 190, 300],
  ['m2', 'muelle', 'muelles', 'Muelle 2', 1190, 560],
  ['sd', 'salida', 'muelles', 'Salida Muelle Dársena', 372, 345],
  ['sl', 'salida', 'muelles', 'Salida Muelle Luján', 968, 345],
]

export const PUNTOS: Punto[] = L.map(([id, tipo, grupo, nombre, x, y, info]) => {
  const [mx, my] = plano(x, y)
  return { id, tipo, grupo, nombre, x: mx, y: my, ...(info ? { info } : {}) }
})

// ───────────────────────── Estructuras ─────────────────────────
// Cada grupo se dibuja en unidades de MUNDO (1 = 10 de mapa), centrado en `x, y`. `rot` en grados SVG.

export interface Caja { t: 'caja'; x: number; z: number; w: number; d: number; c: string; rot?: number; borde?: boolean; op?: number }
export interface Circ { t: 'circ'; x: number; z: number; rx: number; rz?: number; c: string; rot?: number; borde?: boolean; hueco?: boolean }
export type Prim = Caja | Circ

export interface Grupo3D {
  id: string
  x: number
  y: number
  /** Matriz propia (el Edén va girado). Si falta, escala uniforme 10. */
  giro?: number
  prims: Prim[]
}

const caja = (x: number, z: number, w: number, d: number, c: string, o: Partial<Caja> = {}): Caja => ({ t: 'caja', x, z, w, d, c, ...o })
const circ = (x: number, z: number, rx: number, c: string, o: Partial<Circ> = {}): Circ => ({ t: 'circ', x, z, rx, c, ...o })

const C = {
  amarillo: '#c99a2c', verde: '#56703a', lona: '#efe3cc', madera: '#7a4b2c', negro: '#16110f', rojo: '#8a1c14',
  naranja: '#e0864a', blanco: '#e9e2d6', oro: '#c79a3c', neonR: '#ff2414', neonA: '#ffa040',
}

const edenGiro = 0.27
const mundoEden: Pt = [53.6, -19.5]

function edenPrims(rng: () => number): Prim[] {
  const AN = 20, PR = 30
  const p: Prim[] = []
  p.push(caja(0, 0, AN, PR, '#fffcdc', { borde: true, op: 0.55 }))
  // galpones de lona detrás
  ;[-6, 6].forEach((d) => p.push(caja(d, -PR / 2 - 8.5, 10.4, 9, C.lona, { borde: true })))
  // cabina: barra negra + paneles de vidrio rojo
  p.push(caja(0, -PR / 2 + 2.2, 10, 1.4, C.negro))
  ;([[-4.2, 2.4], [-2.6, 1.9], [-1.1, 2], [1.6, 2.3], [3.2, 1.6]] as [number, number][]).forEach(([x, w], i) =>
    p.push(caja(x, -PR / 2 + 1.1 - (i % 2) * 0.35, w, 0.22, i % 2 ? C.neonA : C.neonR)))
  p.push(circ(0, -PR / 2 + 1.3, 0.42, '#1c1a1e'))
  // Funktion-One: 2 stacks altos y 2 delays laterales
  ;([[-6.4, -PR / 2 + 2, 0.12], [6.4, -PR / 2 + 2, -0.12], [-AN / 2 - 1.2, 1, (Math.PI / 2) * 0.9], [AN / 2 + 1.2, 1, -(Math.PI / 2) * 0.9]] as [number, number, number][])
    .forEach(([x, z, ry]) => p.push(caja(x, z, 1.5, 1.3, '#111013', { rot: -ry * (180 / Math.PI) })))
  // faroles de 4 luces
  ;([[-8.2, -PR / 2 + 3.6], [-4.5, -PR / 2 + 4.4], [-0.2, -PR / 2 + 4.8], [4.4, -PR / 2 + 4.4], [8.4, -PR / 2 + 3.6], [-AN / 2 + 0.3, -PR / 2 + 7]] as [number, number][])
    .forEach(([x, z]) => { p.push(circ(x, z, 0.5, C.negro)); p.push(circ(x, z, 0.2, '#ffb35c')) })
  // control de sonido en medio del público
  p.push(caja(4.5, 5, 4.2, 3.4, C.blanco, { borde: true }))
  p.push(caja(4.5, 5.4, 2.6, 1, C.madera))
  // público: grilla con desorden, más ralo hacia el fondo
  const pts: Pt[] = []
  for (let z = -PR / 2 + 5.6; z < PR / 2 - 0.4; z += 0.95)
    for (let x = -AN / 2 + 0.5; x < AN / 2 - 0.4; x += 0.88) {
      const px = x + (rng() - 0.5) * 0.55, pz = z + (rng() - 0.5) * 0.5
      if (Math.abs(px - 4.5) < 2.6 && Math.abs(pz - 5) < 2.2) continue
      if (rng() < 0.1) continue
      if (rng() > 1 - Math.max(0, (pz - (-PR / 2 + 5)) / PR) * 0.45) continue
      pts.push([px, pz])
    }
  pts.forEach(([x, z]) => { p.push(circ(x, z, 0.28, '#5a6070')); rng(); rng() }) // el original gasta 2 azares por persona
  return p
}

/** Árboles, claros y gente: salen de un único generador con semilla, en el orden del original. */
function generar() {
  const rng = ((s) => () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) | 0), ((s ^ (s >>> 7)) >>> 0) / 4294967296))(7)

  const tierra = [
    [520, -60], [1340, -60], [1340, 575], [1150, 600], [1000, 612], [860, 628], [720, 630], [590, 628], [470, 612],
    [360, 585], [260, 550], [195, 505], [170, 445], [168, 380], [192, 322], [250, 262], [318, 190], [395, 110], [455, 40],
  ] as Pt[]
  const costa = [[-80, -60], [430, -60], [380, 10], [300, 95], [205, 180], [110, 262], [30, 320], [-80, 345]] as Pt[]
  const dentro = (x: number, y: number, p: Pt[]) => {
    let c = false
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const claros: [number, number, number][] = L.filter((l) => !['sd', 'sl', 'm1', 'm2'].includes(l[0]))
    .map((l): [number, number, number] => [l[4], l[5], RADIOS[l[0]] * 0.95])
  claros.push([690, 330, 230], [800, 560, 250], [1175, 240, 175], [1110, 95, 95], [1000, 140, 70], [1050, 600, 120], [648, 520, 90])
  const libre = (x: number, y: number) => {
    for (const [cx, cy, r] of claros) if (((x - cx) / (r * 1.05)) ** 2 + ((y - cy) / (r * 0.62)) ** 2 < 1) return false
    for (const c of CAMINOS_PLANO) for (const [px, py] of c) if (Math.hypot(x - px, (y - py) * 1.4) < 26) return false
    return true
  }

  const arboles: { x: number; y: number; r: number; k: number; costa: boolean }[] = []
  for (let x = -60; x < 1340; x += 21)
    for (let y = -50; y < 640; y += 13) {
      const px = x + rng() * 16, py = y + rng() * 10
      const enT = dentro(px, py, tierra), enC = dentro(px, py, costa)
      if (!(enT || enC)) continue
      if (enT && !libre(px, py)) continue
      if (enT && rng() < 0.18) continue
      const s = 0.75 + rng() * 0.75
      const [mx, my] = plano(px, py)
      arboles.push({ x: mx, y: my, r: 23 * s, k: rng(), costa: enC })
    }

  const eden = edenPrims(rng)

  const gente: Pt[] = []
  ;([[690, 335, 150, 80, 110], [425, 430, 70, 40, 34], [848, 288, 55, 35, 22], [800, 555, 140, 40, 30], [848, 125, 60, 18, 24]] as number[][])
    .forEach(([x, y, a, b, n]) => {
      for (let i = 0; i < n; i++) {
        let u: number, v: number
        do { u = rng() * 2 - 1; v = rng() * 2 - 1 } while (u * u + v * v > 1)
        gente.push(plano(x + u * a * 0.5, y + v * b * 0.5 + (x === 690 ? 14 : 0)))
      }
    })

  // Margen recreado: más monte en las zonas que el original no cubría, con otro azar para no tocar el de Ana.
  const r2 = ((s) => () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) | 0), ((s ^ (s >>> 7)) >>> 0) / 4294967296))(11)
  for (let x = -420; x < 1720; x += 21)
    for (let y = -270; y < 700; y += 13) {
      if (x >= -60 && x < 1340 && y >= -50 && y < 640) continue
      const px = x + r2() * 16, py = y + r2() * 10
      const enT = dentro(px, py, TIERRA_PLANO), enC = dentro(px, py, COSTA_PLANO)
      if (!(enT || enC)) continue
      if (enT && !libre(px, py)) continue
      if (r2() < 0.18) continue
      const s = 0.75 + r2() * 0.75
      const [mx, my] = plano(px, py)
      arboles.push({ x: mx, y: my, r: 23 * s, k: r2(), costa: enC })
    }
  return { arboles, eden, gente }
}

const RADIOS: Record<string, number> = {
  sv: 135, eden: 150, chill: 90, inst: 120, panel: 60, carpa: 105, domo: 78, merc: 62, chir: 36, barra: 88, banos: 72,
}
const CAMINOS_PLANO: Pt[][] = [
  [[190, 300], [260, 300], [330, 330], [420, 335], [520, 330]],
  [[520, 330], [540, 280], [520, 230], [540, 170], [560, 120], [600, 105]],
  [[860, 240], [930, 235], [990, 170], [1000, 110], [990, 60]],
  [[1000, 110], [1060, 240], [1120, 380], [1170, 480], [1195, 560]],
  [[300, 520], [260, 470], [250, 410], [300, 350]],
] as Pt[][]

const gen = generar()

/** Árboles: `k` es el azar del color; más de 0,94 es el árbol raro. */
export const ARBOLES = gen.arboles
export const GENTE = gen.gente

/** Pista del Edén, en unidades de mundo dentro de un grupo girado. */
export const EDEN: Grupo3D = {
  id: 'eden', x: plano(640 + mundoEden[0] / SX, 360 + mundoEden[1] / SZ)[0], y: plano(640 + mundoEden[0] / SX, 360 + mundoEden[1] / SZ)[1],
  giro: edenGiro, prims: gen.eden,
}

const en = (x: number, y: number): { x: number; y: number } => { const [mx, my] = plano(x, y); return { x: mx, y: my } }

export const ESTRUCTURAS: Grupo3D[] = [
  { id: 'banos', ...en(648, 100), prims: [caja(-2.9, 0, 5.2, 2.6, C.amarillo, { borde: true }), caja(2.9, 0, 5.2, 2.6, C.verde, { borde: true })] },
  {
    id: 'barra', ...en(848, 97),
    prims: [
      caja(0, 0, 14, 5.6, C.lona, { borde: true }),
      ...[-4.5, -1.5, 1.5, 4.5].flatMap((d, i) => [caja(d - 0.8, 2.86, 0.3, 0.3, i % 2 ? C.neonA : C.neonR), caja(d + 0.8, 2.86, 0.3, 0.3, i % 2 ? C.neonR : C.neonA)]),
      caja(0, 4, 9, 1.1, C.negro),
    ],
  },
  {
    id: 'carpa', ...en(640, 195),
    prims: [
      circ(-3.6, 0, 7.2, C.lona, { borde: true }), circ(3.6, 0, 7.2, C.lona, { borde: true }),
      ...([[-10, 0], [10, 0], [0, -5], [0, 5]] as Pt[]).map(([x, z]) => circ(x, z, 0.3, C.madera)),
    ],
  },
  { id: 'domo', ...en(902, 178), prims: [circ(0, 0, 5.2, C.naranja, { borde: true })] },
  {
    id: 'panel', ...en(365, 247),
    prims: [
      circ(0, 0, 3.6, C.oro, { borde: true, hueco: true }),
      ...Array.from({ length: 10 }, (_, i) => caja(Math.cos((i / 10) * Math.PI * 2) * 2, Math.sin((i / 10) * Math.PI * 2) * 2, 0.7, 0.7, C.madera)),
    ],
  },
  { id: 'chir', ...en(522, 250), prims: [caja(0, 0, 3, 2.6, C.madera, { borde: true }), caja(0, 0, 2.6, 2.2, C.blanco)] },
  {
    id: 'merc', ...en(848, 288),
    prims: ([[-4, -1.5], [0, -2.2], [4, -1.5], [-2, 2.4], [2.6, 2.4]] as Pt[]).flatMap(([x, z], i) => [
      caja(x, z, 2.2, 1.2, C.madera),
      caja(x, z, 2.4, 2.4, i % 2 ? C.lona : C.rojo, { rot: 45, borde: true, op: 0.92 }),
    ]),
  },
  { id: 'sv', ...en(690, 335), prims: [caja(-2.6, -6, 0.5, 0.5, C.rojo), caja(2.6, -6, 0.5, 0.5, C.rojo), caja(0, -6, 6.4, 0.5, C.rojo)] },
  {
    id: 'inst', ...en(800, 550),
    prims: ([[-7, 0, C.neonR], [-3.5, -1.4, C.neonA], [0, 0.6, C.neonR], [3.4, -1, C.neonA], [6.8, 0.4, C.neonR]] as [number, number, string][]).flatMap(
      ([x, z, c], i) => [caja(x, z, 1.9, 0.3, c, { rot: -(i - 2) * 0.12 * (180 / Math.PI) }), caja(x - 0.9, z, 0.3, 0.3, c), caja(x + 0.9, z, 0.3, 0.3, c)]),
  },
  {
    id: 'chill', ...en(425, 430),
    prims: ([[-3, 0, '#8a2a1c'], [2.5, -1, '#6a3f1e'], [0, 2.6, '#9a6a2a']] as [number, number, string][]).flatMap(([x, z, c]) => [
      caja(x, z, 3.6, 2.4, c),
      ...[0, 1, 2].map((k) => caja(x - 1 + k, z + 1.1, 0.6, 0.6, C.blanco)),
    ]),
  },
  { id: 'muelle1', ...en(190, 300), prims: [caja(0, 3.2, 2.4, 8, C.madera, { borde: true }), caja(1.8, -0.6, 1.8, 1.6, C.madera, { borde: true })] },
  { id: 'muelle2', ...en(1190, 560), prims: [caja(0, 3.2, 2.4, 8, C.madera, { borde: true, rot: -0.2 * (180 / Math.PI) }), caja(1.8, -0.6, 1.8, 1.6, C.madera, { borde: true })] },
  { id: 'bote', ...en(150, 300), prims: [{ t: 'circ', x: 0, z: 2, rx: 2.3, rz: 0.8, c: C.blanco, rot: -0.5 * (180 / Math.PI), borde: true }] },
]
