import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Perillas de secciones públicas en venue_config (cineclub_activo,
 * cowork_activo). Mientras el valor está en null todavía no sabemos si la
 * sección se muestra: quien la use debe esperar (loading) antes de renderizar
 * o redirigir, si no la sección parpadea al entrar.
 */
function useSeccionPublica(campo: 'cineclub_activo' | 'cowork_activo') {
  const [activo, setActivo] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('venue_config')
      .select(campo)
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (!cancelado) {
          setActivo((data as Record<string, boolean> | null)?.[campo] ?? false)
        }
      })
    return () => { cancelado = true }
  }, [campo])

  return { activo: activo === true, loading: activo === null }
}

export function useCineclubActivo() {
  return useSeccionPublica('cineclub_activo')
}

export function useCoworkActivo() {
  return useSeccionPublica('cowork_activo')
}
