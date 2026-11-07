/**
 * DATOS DE MAQUETA del mapa. La forma de la isla, los senderos, los muelles y la posición
 * de cada punto son un dibujo de EJEMPLO. Cuando la organización pase el dibujo real hay
 * dos caminos:
 *   · Si viene como imagen (PNG, WebP o SVG): poner su URL en `IMAGEN_BASE` y reubicar
 *     `PUNTOS`. La imagen reemplaza todo el dibujo de abajo, que queda sin usarse.
 *   · Si se redibuja en código: cambiar `ISLA`, `COSTA`, `SENDEROS`, `MUELLES` y `PUNTOS`.
 * La interfaz (MapaIsla) no depende de esta geometría: solo lee estos datos.
 *
 * Coordenadas en unidades de mapa, de 0 a MAPA_W × 0 a MAPA_H (origen arriba a la izquierda).
 * El lugar es una isla frente al muelle de San Fernando (Tigre), a unos dos minutos en lancha.
 */

export const MAPA_W = 1400
export const MAPA_H = 1000

export type Pt = [number, number]

/** Contorno de la isla. */
export const ISLA: Pt[] = [
  [520, 330], [610, 282], [730, 262], [850, 288], [950, 252], [1050, 292], [1100, 385], [1080, 475],
  [1130, 565], [1080, 665], [990, 725], [880, 705], [790, 765], [680, 745], [590, 695], [560, 605],
  [500, 525], [490, 425],
]

/** La costa de San Fernando, al borde izquierdo. */
export const COSTA: Pt[] = [
  [0, 0], [250, 0], [270, 120], [230, 260], [285, 400], [250, 540], [300, 660], [240, 800], [270, 920], [250, 1000], [0, 1000],
]

/** El claro donde pasa la fiesta. */
export const CLARO: Pt[] = [[690, 440], [790, 430], [850, 490], [830, 560], [740, 580], [680, 520]]

/** Imagen que reemplaza el dibujo (mismo alto/ancho que el mapa: MAPA_W × MAPA_H). */
export const IMAGEN_BASE: string | null = null

/** Caminos de la isla: parten del muelle y llegan a cada zona. */
export const SENDEROS: Pt[][] = [
  [[527, 583], [600, 570], [690, 550], [765, 545]],
  [[765, 545], [760, 500], [740, 470]],
  [[765, 545], [800, 600], [800, 650]],
  [[765, 545], [850, 555], [950, 560], [1020, 560]],
  [[740, 470], [720, 420], [690, 385], [650, 365]],
  [[760, 500], [830, 440], [880, 405], [930, 370], [960, 345]],
  [[950, 560], [985, 470]],
  [[600, 570], [645, 565]],
  [[690, 440], [625, 470]],
]

/** Construcciones: el galpón, las carpas y la cúpula del claro. */
export const EDIFICIOS: { puntos: Pt[]; relleno: string }[] = [
  { puntos: [[880, 300], [980, 290], [985, 325], [885, 335]], relleno: '#9c9c92' },
  { puntos: [[700, 448], [734, 446], [736, 468], [702, 470]], relleno: '#fffcdc' },
  { puntos: [[800, 505], [818, 505], [818, 520], [800, 520]], relleno: '#f65200' },
]
export const CUPULA = { x: 772, y: 452, r: 13 }

/** Nombres de zona sobre el dibujo, como los de barrio en un mapa de juego. */
export const ETIQUETAS: { texto: string; x: number; y: number; rot?: number; tam?: number; sobre?: 'agua' | 'tierra' }[] = [
  { texto: 'EL CLARO', x: 756, y: 612, tam: 22 },
  { texto: 'LA ISLA', x: 800, y: 235, tam: 30 },
  { texto: 'SAN FERNANDO', x: 120, y: 520, rot: -90, tam: 30, sobre: 'tierra' },
  { texto: '2 MIN EN LANCHA', x: 420, y: 482, tam: 15, sobre: 'agua' },
]

export const MUELLES: Pt[][] = [
  [[262, 512], [345, 516], [345, 526], [262, 530]], // San Fernando
  [[498, 572], [560, 585], [558, 597], [495, 584]], // la isla
]

/** Recorrido de las lanchas entre los dos muelles. */
export const RUTA_LANCHAS = 'M 345 521 C 400 520, 450 560, 497 578'

export type TipoPunto = 'escenario' | 'charlas' | 'bano' | 'medico' | 'agua' | 'barra' | 'chill' | 'muelle'

export const TIPOS_PUNTO: { id: TipoPunto; nombre: string; marca: string }[] = [
  { id: 'escenario', nombre: 'Escenarios', marca: 'E' },
  { id: 'charlas', nombre: 'Panel de charlas', marca: 'S' },
  { id: 'barra', nombre: 'Barra', marca: 'B' },
  { id: 'chill', nombre: 'Tronco ambiente chill', marca: 'C' },
  { id: 'bano', nombre: 'Baños', marca: 'WC' },
  { id: 'agua', nombre: 'Hidratación', marca: 'H₂O' },
  { id: 'medico', nombre: 'Médico', marca: '+' },
  { id: 'muelle', nombre: 'Muelles', marca: 'M' },
]

export interface Punto { id: string; tipo: TipoPunto; nombre: string; x: number; y: number }

/** El muelle de la isla es la llegada: desde ahí sale la ruta de "Ir acá". */
export const ID_LLEGADA = 'm-muelle-isla'

export const PUNTOS: Punto[] = [
  { id: 'm-muelle-sf', tipo: 'muelle', nombre: 'Muelle San Fernando', x: 300, y: 521 },
  { id: ID_LLEGADA, tipo: 'muelle', nombre: 'Muelle de la isla', x: 527, y: 583 },
  { id: 'm-eden', tipo: 'escenario', nombre: 'El Edén', x: 740, y: 470 },
  { id: 'm-tronk', tipo: 'escenario', nombre: 'The Tronk', x: 960, y: 345 },
  { id: 'm-beso', tipo: 'escenario', nombre: 'El Beso', x: 1020, y: 560 },
  { id: 'm-bello', tipo: 'escenario', nombre: 'Bello Horizonte', x: 800, y: 650 },
  { id: 'm-sinapsis', tipo: 'charlas', nombre: 'Sinapsis', x: 650, y: 365 },
  { id: 'm-chill', tipo: 'chill', nombre: 'Tronco chill', x: 880, y: 405 },
  { id: 'm-barra', tipo: 'barra', nombre: 'Barra central', x: 765, y: 545 },
  { id: 'm-bano1', tipo: 'bano', nombre: 'Baños', x: 645, y: 565 },
  { id: 'm-bano2', tipo: 'bano', nombre: 'Baños', x: 985, y: 470 },
  { id: 'm-agua1', tipo: 'agua', nombre: 'Hidratación', x: 700, y: 425 },
  { id: 'm-agua2', tipo: 'agua', nombre: 'Hidratación', x: 905, y: 560 },
  { id: 'm-medico', tipo: 'medico', nombre: 'Médico', x: 625, y: 470 },
]
