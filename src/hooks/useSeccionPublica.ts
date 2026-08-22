import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useVenueConfig, sincronizarVenueConfig, type Visibilidad } from '../store/useVenueConfig'

/**
 * Visibilidad de las secciones, manejada desde /admin/home → Secciones.
 * El estado vive en useVenueConfig, que se mantiene al día solo.
 *
 * Mientras `loading` es true todavía no sabemos qué se muestra: quien lo use
 * debe esperar antes de renderizar o redirigir, si no la sección parpadea.
 */

export interface Secciones {
  barra: Visibilidad
  cineclub: Visibilidad
  cowork: Visibilidad
}

/** ¿Se lista en el panel? Todo lo que no está oculto. */
export function enPanel(v: Visibilidad): boolean {
  return v !== 'oculto'
}

/**
 * ¿La página pública de esta sección se muestra a quien está mirando?
 *
 * 'interno' existe para poder armar una sección sin exponerla: la página sigue
 * viva, pero sólo para quien tenga sesión de staff. Sin esto no habría forma
 * de previsualizar lo que se está editando.
 */
export function visibleParaMi(v: Visibilidad, haySesion: boolean): boolean {
  if (v === 'publico') return true
  return v === 'interno' && haySesion
}

export function useSecciones(): { secciones: Secciones; loading: boolean } {
  useEffect(() => { sincronizarVenueConfig() }, [])

  const cargado = useVenueConfig(s => s.cargado)
  const barra = useVenueConfig(s => s.barra)
  const cineclub = useVenueConfig(s => s.cineclub)
  const cowork = useVenueConfig(s => s.cowork)

  return { secciones: { barra, cineclub, cowork }, loading: !cargado }
}

/**
 * Para las páginas públicas: si la ven o no, contando la sesión de staff.
 * `soloStaff` es true cuando la están viendo sólo porque hay sesión — sirve
 * para avisar en pantalla que el público todavía no la ve.
 */
function useVisibilidadPublica(seccion: 'cineclub' | 'cowork') {
  const { secciones, loading } = useSecciones()
  const { session } = useAuth()
  const estado = secciones[seccion]
  const haySesion = !!session

  return {
    activo: visibleParaMi(estado, haySesion),
    soloStaff: estado === 'interno' && haySesion,
    estado,
    loading,
  }
}

export function useCineclubActivo() {
  return useVisibilidadPublica('cineclub')
}

export function useCoworkActivo() {
  return useVisibilidadPublica('cowork')
}

/** Fondo de la app. null mientras carga o si nunca se cambió. */
export function useFondo() {
  useEffect(() => { sincronizarVenueConfig() }, [])
  return useVenueConfig(s => s.fondoUrl)
}

/** Presentación de la landing del Cowork Day, ya normalizada. */
export function useCoworkLanding() {
  useEffect(() => { sincronizarVenueConfig() }, [])
  return useVenueConfig(s => s.coworkLanding)
}
