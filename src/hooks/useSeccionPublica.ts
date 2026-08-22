import { useEffect } from 'react'
import { useVenueConfig, sincronizarVenueConfig } from '../store/useVenueConfig'

/**
 * Perillas de secciones. Prenden y apagan tanto secciones públicas (Cineclub,
 * Cowork Day) como del panel (Barra), y se manejan desde /admin/home →
 * Secciones. El estado vive en useVenueConfig, que se mantiene al día solo.
 *
 * Mientras `loading` es true todavía no sabemos qué se muestra: quien las use
 * debe esperar antes de renderizar o redirigir, si no la sección parpadea.
 */
export interface Secciones {
  barra: boolean
  cineclub: boolean
  cowork: boolean
}

export function useSecciones() {
  useEffect(() => { sincronizarVenueConfig() }, [])

  const cargado = useVenueConfig(s => s.cargado)
  const barra = useVenueConfig(s => s.barraActiva)
  const cineclub = useVenueConfig(s => s.cineclubActivo)
  const cowork = useVenueConfig(s => s.coworkActivo)

  return {
    secciones: {
      barra,
      cineclub,
      // En desarrollo el Cowork Day se ve siempre, con la perilla apagada o
      // no: es la sección que se está construyendo y hay que poder probarla
      // sin exponerla al público, que comparte esta misma base de datos.
      cowork: cowork || import.meta.env.DEV,
    } satisfies Secciones,
    loading: !cargado,
  }
}

export function useCineclubActivo() {
  const { secciones, loading } = useSecciones()
  return { activo: secciones.cineclub, loading }
}

export function useCoworkActivo() {
  const { secciones, loading } = useSecciones()
  return { activo: secciones.cowork, loading }
}

/** Fondo de la app. null mientras carga o si nunca se cambió. */
export function useFondo() {
  useEffect(() => { sincronizarVenueConfig() }, [])
  return useVenueConfig(s => s.fondoUrl)
}
