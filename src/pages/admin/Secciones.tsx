import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenueConfig, sincronizarVenueConfig } from '../../store/useVenueConfig'

/**
 * Secciones del panel y de la web pública, prendidas y apagadas a mano.
 *
 * Apagar nunca borra nada ni cierra la ruta: la sección desaparece de la
 * navegación y listo. Es para sacar del medio lo que todavía no se usa sin
 * tener que decidir si se elimina.
 */

type Campo = 'barra_activa' | 'cineclub_activo' | 'cowork_activo'

interface Perilla {
  campo: Campo
  nombre: string
  donde: string
  prendida: string
  apagada: string
}

const PERILLAS: Perilla[] = [
  {
    campo: 'barra_activa',
    nombre: 'Barra',
    donde: 'Panel',
    prendida: 'Visible en la navegación del panel',
    apagada: 'Oculta — las ventas y el stock siguen guardados',
  },
  {
    campo: 'cowork_activo',
    nombre: 'Cowork Day',
    donde: 'Panel y web pública',
    prendida: 'Visible: se puede reservar el pase por día',
    apagada: 'Oculto — nadie ve la sección ni las fechas',
  },
  {
    campo: 'cineclub_activo',
    nombre: 'Cineclub',
    donde: 'Web pública',
    prendida: 'Visible: se puede votar la próxima película',
    apagada: 'Oculto — las votaciones quedan guardadas',
  },
]

export default function Secciones() {
  const [guardando, setGuardando] = useState<Campo | null>(null)
  const [error, setError] = useState('')

  // El estado sale del store compartido, que escucha venue_config en vivo:
  // así el tab de la nav aparece o desaparece en el momento, sin recargar.
  useEffect(() => { sincronizarVenueConfig() }, [])
  const cargado = useVenueConfig(s => s.cargado)
  const estado: Record<Campo, boolean> = {
    barra_activa: useVenueConfig(s => s.barraActiva),
    cineclub_activo: useVenueConfig(s => s.cineclubActivo),
    cowork_activo: useVenueConfig(s => s.coworkActivo),
  }

  const alternar = async (campo: Campo) => {
    if (!cargado || guardando) return
    const nuevo = !estado[campo]
    setGuardando(campo)
    setError('')

    // Con .select() se sabe si la fila se tocó de verdad. Sin esto, un UPDATE
    // que RLS deja en cero filas vuelve sin error: la perilla se dibujaba
    // prendida y al recargar estaba apagada otra vez.
    const { data, error: err } = await supabase
      .from('venue_config')
      .update({ [campo]: nuevo })
      .eq('id', 1)
      .select('id')

    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.')
    } else if (!data || data.length === 0) {
      setError('No se pudo guardar: tu usuario no tiene permiso para cambiar esto.')
    } else {
      await useVenueConfig.getState().cargar()
    }
    setGuardando(null)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-white font-semibold text-lg">Secciones</h3>
        <p className="text-gray-500 text-sm mt-1">
          Qué se ve y qué no, en el panel y en la web pública. Apagar una
          sección no borra nada: los datos quedan y vuelven al encenderla.
        </p>
      </div>

      <div className="space-y-3">
        {PERILLAS.map(p => {
          const prendida = estado[p.campo] === true
          return (
            <button
              key={p.campo}
              onClick={() => alternar(p.campo)}
              disabled={!cargado || guardando !== null}
              className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 disabled:opacity-60 rounded-xl px-4 py-3.5 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{p.nombre}</p>
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 border border-white/15 rounded-full px-2 py-0.5">
                    {p.donde}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">
                  {!cargado ? 'Cargando...' : prendida ? p.prendida : p.apagada}
                </p>
              </div>
              <span
                className={`w-11 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors ${
                  prendida ? 'bg-emerald-600 justify-end' : 'bg-white/20 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white block" />
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <p className="text-gray-600 text-xs leading-relaxed">
        Los cambios se aplican al instante, también en el celular de quien
        tenga el panel abierto. Apagar una sección no cierra su dirección:
        quien tenga el link guardado sigue entrando.
      </p>
    </div>
  )
}
