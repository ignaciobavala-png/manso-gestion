import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenueConfig, sincronizarVenueConfig, type Visibilidad } from '../../store/useVenueConfig'

/**
 * Cuánto se ve cada sección, en el panel y afuera.
 *
 * Tres estados en escalera en vez de dos perillas sueltas: así no existe el
 * estado inválido "público pero sin panel". El del medio, "Solo panel", es el
 * que permite armar una sección con tranquilidad — se ve adentro y, para
 * previsualizarla, su página pública responde a quien tenga sesión de staff.
 *
 * Apagar nunca borra nada ni cierra la ruta.
 */

type Seccion = 'barra' | 'cineclub' | 'cowork'

interface Config {
  seccion: Seccion
  nombre: string
  /** Columna nueva y booleano viejo, que se siguen escribiendo juntos. */
  columna: string
  columnaLegacy: string
  /** Barra no tiene página pública. */
  tienePublico: boolean
  descripciones: Record<Visibilidad, string>
}

const SECCIONES: Config[] = [
  {
    seccion: 'cowork',
    nombre: 'Cowork Day',
    columna: 'cowork_visibilidad',
    columnaLegacy: 'cowork_activo',
    tienePublico: true,
    descripciones: {
      oculto: 'No se ve en ningún lado',
      interno: 'Se ve en el panel. Afuera, sólo para quien tenga sesión',
      publico: 'Cualquiera puede ver las fechas y reservar',
    },
  },
  {
    seccion: 'cineclub',
    nombre: 'Cineclub',
    columna: 'cineclub_visibilidad',
    columnaLegacy: 'cineclub_activo',
    tienePublico: true,
    descripciones: {
      oculto: 'No se ve en ningún lado',
      interno: 'Se ve en el panel. Afuera, sólo para quien tenga sesión',
      publico: 'Cualquiera puede votar la próxima película',
    },
  },
  {
    seccion: 'barra',
    nombre: 'Barra',
    columna: 'barra_visibilidad',
    columnaLegacy: 'barra_activa',
    tienePublico: false,
    descripciones: {
      oculto: 'Fuera de la navegación. Las ventas y el stock quedan guardados',
      interno: 'Visible en el panel',
      publico: '',
    },
  },
]

const ETIQUETAS: Record<Visibilidad, string> = {
  oculto: 'Oculto',
  interno: 'Solo panel',
  publico: 'Público',
}

export default function Secciones() {
  const [guardando, setGuardando] = useState<Seccion | null>(null)
  const [error, setError] = useState('')

  // El estado sale del store compartido, que escucha venue_config en vivo:
  // así el tab de la nav aparece o desaparece en el momento, sin recargar.
  useEffect(() => { sincronizarVenueConfig() }, [])
  const cargado = useVenueConfig(s => s.cargado)
  const estado: Record<Seccion, Visibilidad> = {
    barra: useVenueConfig(s => s.barra),
    cineclub: useVenueConfig(s => s.cineclub),
    cowork: useVenueConfig(s => s.cowork),
  }

  const cambiar = async (config: Config, valor: Visibilidad) => {
    if (!cargado || guardando) return
    if (estado[config.seccion] === valor) return

    setGuardando(config.seccion)
    setError('')

    // Se escribe también el booleano viejo mientras producción pueda estar
    // corriendo el deploy anterior, que es lo único que esa versión sabe
    // leer. Sin esto, cambiar el estado desde acá no se vería allá.
    const cambios: Record<string, unknown> = {
      [config.columna]: valor,
      [config.columnaLegacy]: config.tienePublico ? valor === 'publico' : valor !== 'oculto',
    }

    // Con .select() se sabe si la fila se tocó de verdad. Sin esto, un UPDATE
    // que RLS deja en cero filas vuelve sin error: la pantalla se dibujaba
    // como si hubiera guardado y al recargar estaba todo como antes.
    const { data, error: err } = await supabase
      .from('venue_config')
      .update(cambios)
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
        <p className="text-gray-400 text-sm mt-1">
          Qué se ve y qué no. <span className="text-gray-400">Solo panel</span> te
          deja trabajar en una sección sin que el público la vea: aparece acá
          adentro y su página se abre sólo si tenés la sesión iniciada.
        </p>
      </div>

      <div className="space-y-3">
        {SECCIONES.map(config => {
          const actual = estado[config.seccion]
          const opciones: Visibilidad[] = config.tienePublico
            ? ['oculto', 'interno', 'publico']
            : ['oculto', 'interno']

          return (
            <div
              key={config.seccion}
              className="bg-white/5 border border-white/20 rounded-xl px-4 py-3.5 space-y-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-white text-sm font-medium">{config.nombre}</p>
                {!config.tienePublico && (
                  <span className="text-[10px] uppercase tracking-widest text-gray-400">
                    sin página pública
                  </span>
                )}
              </div>

              <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
                {opciones.map(opcion => (
                  <button
                    key={opcion}
                    onClick={() => cambiar(config, opcion)}
                    disabled={!cargado || guardando !== null}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      actual === opcion
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {ETIQUETAS[opcion]}
                  </button>
                ))}
              </div>

              <p className="text-gray-400 text-sm">
                {!cargado ? 'Cargando...' : config.descripciones[actual]}
              </p>
            </div>
          )
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <p className="text-gray-400 text-xs leading-relaxed">
        Los cambios se aplican al instante, también en el celular de quien tenga
        el panel abierto. Nada de esto borra datos, y ocultar una sección no
        cierra su dirección: quien tenga el link guardado sigue entrando.
      </p>
    </div>
  )
}
