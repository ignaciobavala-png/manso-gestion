import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { normalizarLanding, type CoworkLanding } from '../lib/coworkLanding'

/**
 * venue_config vivo y compartido.
 *
 * Antes cada componente que necesitaba una perilla hacía su propia consulta y
 * se quedaba con esa foto para siempre: prender una sección guardaba bien en
 * la base, pero la navegación seguía mostrando lo de antes hasta recargar, y
 * parecía que el toggle no hacía nada.
 *
 * Ahora hay una sola consulta y un solo canal de realtime para toda la app:
 * cualquier cambio en venue_config —desde esta pestaña o desde el celular de
 * otra persona— repinta todo lo que dependa de él.
 */

/**
 * Cuánto se ve una sección:
 *   oculto   en ningún lado
 *   interno  en el panel, y su página pública sólo para quien tenga sesión
 *   publico  para todos
 *
 * Es una escalera, no dos perillas sueltas: así no existe el estado inválido
 * "público pero sin panel". Barra nunca llega a 'publico': no tiene página.
 */
export type Visibilidad = 'oculto' | 'interno' | 'publico'

export interface VenueConfigState {
  cargado: boolean
  barra: Visibilidad
  cineclub: Visibilidad
  cowork: Visibilidad
  /** null = usar la foto por defecto que viene con la app. */
  fondoUrl: string | null
  coworkLanding: CoworkLanding
  cargar: () => Promise<void>
}

function aVisibilidad(valor: unknown, fallback: Visibilidad = 'oculto'): Visibilidad {
  return valor === 'oculto' || valor === 'interno' || valor === 'publico' ? valor : fallback
}

export const useVenueConfig = create<VenueConfigState>(set => ({
  cargado: false,
  barra: 'oculto',
  cineclub: 'oculto',
  cowork: 'oculto',
  fondoUrl: null,
  coworkLanding: normalizarLanding(null),

  cargar: async () => {
    const { data } = await supabase
      .from('venue_config')
      .select('barra_visibilidad, cineclub_visibilidad, cowork_visibilidad, background_url, cowork_landing')
      .eq('id', 1)
      .single()

    set({
      cargado: true,
      barra: aVisibilidad(data?.barra_visibilidad),
      cineclub: aVisibilidad(data?.cineclub_visibilidad),
      cowork: aVisibilidad(data?.cowork_visibilidad),
      fondoUrl: data?.background_url ?? null,
      coworkLanding: normalizarLanding(data?.cowork_landing),
    })
  },
}))

// Módulo, no componente: la carga y la suscripción pasan una sola vez por
// pestaña, aunque haya diez componentes leyendo la configuración.
let enVuelo: Promise<void> | null = null
let suscripto = false

export function sincronizarVenueConfig() {
  if (!enVuelo) {
    enVuelo = useVenueConfig.getState().cargar().finally(() => { enVuelo = null })
  }

  if (!suscripto) {
    suscripto = true
    supabase
      .channel('venue_config_cambios')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'venue_config' },
        () => { useVenueConfig.getState().cargar() }
      )
      .subscribe()
  }
}
