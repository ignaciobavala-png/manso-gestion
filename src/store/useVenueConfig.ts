import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * venue_config vivo y compartido.
 *
 * Antes cada componente que necesitaba una perilla hacía su propia consulta y
 * se quedaba con esa foto para siempre: prender "Barra" en Secciones guardaba
 * bien en la base, pero la navegación seguía mostrando lo de antes hasta
 * recargar el panel, y parecía que el toggle no hacía nada.
 *
 * Ahora hay una sola consulta y un solo canal de realtime para toda la app:
 * cualquier cambio en venue_config —desde esta pestaña o desde el celular de
 * otra persona— repinta todo lo que dependa de él.
 */

export interface VenueConfigState {
  cargado: boolean
  barraActiva: boolean
  cineclubActivo: boolean
  coworkActivo: boolean
  /** null = usar la foto por defecto que viene con la app. */
  fondoUrl: string | null
  cargar: () => Promise<void>
}

export const useVenueConfig = create<VenueConfigState>(set => ({
  cargado: false,
  barraActiva: false,
  cineclubActivo: false,
  coworkActivo: false,
  fondoUrl: null,

  cargar: async () => {
    const { data } = await supabase
      .from('venue_config')
      .select('barra_activa, cineclub_activo, cowork_activo, background_url')
      .eq('id', 1)
      .single()

    set({
      cargado: true,
      barraActiva: data?.barra_activa === true,
      cineclubActivo: data?.cineclub_activo === true,
      coworkActivo: data?.cowork_activo === true,
      fondoUrl: data?.background_url ?? null,
    })
  },
}))

// Módulo, no componente: la carga y la suscripción pasan una sola vez por
// pestaña, aunque haya diez componentes leyendo las perillas.
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
