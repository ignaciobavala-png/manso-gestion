import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Perilla de venue_config.cineclub_activo. Mientras está en null todavía no
 * sabemos si la sección se muestra: quien la use debe esperar (loading) antes
 * de renderizar o redirigir, si no el Cineclub parpadea al entrar.
 */
export function useCineclubActivo() {
  const [activo, setActivo] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('venue_config')
      .select('cineclub_activo')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (!cancelado) setActivo(data?.cineclub_activo ?? false)
      })
    return () => { cancelado = true }
  }, [])

  return { activo: activo === true, loading: activo === null }
}
