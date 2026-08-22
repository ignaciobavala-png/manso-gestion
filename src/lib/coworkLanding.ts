/**
 * Presentación de la landing del Cowork Day.
 *
 * Lo guardado vive en venue_config.cowork_landing (JSONB). Estos valores son
 * el punto de partida y el paracaídas: si falta un campo —porque se guardó una
 * versión vieja del objeto, o porque alguien borró todo— la página muestra
 * esto y no un hueco.
 */

export interface TarjetaIncluye {
  id: string
  icono: string
  titulo: string
  detalle: string
}

export interface CoworkLanding {
  titulo: string
  leyenda: string
  /** Por qué se piden teléfono e Instagram. Va al pie del formulario. */
  notaDatos: string
  portadaUrl: string | null
  incluye: TarjetaIncluye[]
}

export const LANDING_POR_DEFECTO: CoworkLanding = {
  titulo: 'Cowork Day',
  leyenda:
    'Un día de trabajo compartido con nuestra comunidad. Espacio ideal para ' +
    'creativos, freelancers, entusiastas o personas con ideas.',
  notaDatos:
    'Para reservar te pedimos nombre, teléfono e Instagram. Es un espacio ' +
    'chico y compartido: nos gusta saber quién viene.',
  portadaUrl: null,
  incluye: [],
}

/** Emojis sugeridos en el editor. No es una lista cerrada: se puede escribir otro. */
export const ICONOS_SUGERIDOS = ['🪑', '📶', '☕', '🤫', '🔌', '🌿', '🖨️', '🧑‍💻', '🍽️', '🎧']

export function nuevaTarjeta(): TarjetaIncluye {
  return { id: crypto.randomUUID(), icono: '🪑', titulo: '', detalle: '' }
}

/**
 * Mezcla lo guardado con los valores por defecto. Tolera null, un objeto a
 * medias y una lista de tarjetas con filas rotas.
 */
export function normalizarLanding(guardado: unknown): CoworkLanding {
  const dato = (guardado ?? {}) as Partial<CoworkLanding>

  const incluye = Array.isArray(dato.incluye)
    ? dato.incluye
        .filter((t): t is TarjetaIncluye => !!t && typeof t === 'object')
        .map((t, i) => ({
          id: typeof t.id === 'string' ? t.id : `tarjeta-${i}`,
          icono: typeof t.icono === 'string' ? t.icono : '•',
          titulo: typeof t.titulo === 'string' ? t.titulo : '',
          detalle: typeof t.detalle === 'string' ? t.detalle : '',
        }))
    : LANDING_POR_DEFECTO.incluye

  return {
    titulo: dato.titulo?.trim() || LANDING_POR_DEFECTO.titulo,
    leyenda: dato.leyenda?.trim() || LANDING_POR_DEFECTO.leyenda,
    notaDatos: dato.notaDatos?.trim() || LANDING_POR_DEFECTO.notaDatos,
    portadaUrl: dato.portadaUrl ?? null,
    incluye,
  }
}
