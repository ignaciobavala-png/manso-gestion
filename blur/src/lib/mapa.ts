/**
 * DATOS DE MAQUETA del mapa. La forma de la isla, los muelles y la posición de cada
 * punto son un dibujo de EJEMPLO: la organización va a pasar el dibujo real y ahí se
 * cambian `ISLA`, `COSTA`, `MUELLES` y `PUNTOS`. La interfaz (MapaIsla) no depende
 * de esta geometría: solo lee estos datos.
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

export const GALPON: Pt[] = [[880, 300], [980, 290], [985, 325], [885, 335]]

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
