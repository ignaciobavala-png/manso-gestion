import { Link } from 'react-router-dom'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { filtroPorId } from '../lib/filtros'
import { numeroRollo } from '../lib/fotos'
import { FOTOS_POR_PERSONA } from '../lib/mock'
import { diasParaRevelado } from '../lib/revelado'
import { useBlur } from '../lib/store'

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Revelado: hasta después del festival no hay fotos para ver. Lo que sí se ve es
 * el rollo de la persona en el laboratorio: su hoja de contactos con las imágenes
 * latentes (colores borrosos, nunca la foto) y el estado del trámite.
 */
export default function Revelado() {
  const { fotosSacadas, pelicula, tira } = useBlur()
  const dias = diasParaRevelado()
  const nombrePelicula = pelicula ? filtroPorId(pelicula).nombre : '—'

  const cuando =
    dias === null ? 'Después del festival' : dias > 0 ? `En ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Ya se está revisando'

  const filas: [string, string][] = [
    ['Rollo Nº', numeroRollo()],
    ['Película', nombrePelicula],
    ['Fotos', `${fotosSacadas} / ${FOTOS_POR_PERSONA}`],
    ['Estado', fotosSacadas === 0 ? 'Sin cargar' : fotosSacadas < FOTOS_POR_PERSONA ? 'En la cámara' : 'En el laboratorio'],
    ['Revelado', cuando],
  ]

  return (
    <Pagina>
      <Rotulo>Analógica</Rotulo>
      <Titulo className="mt-5">Revelado</Titulo>

      <p className="mt-6 max-w-[30ch] text-sm text-apagado">
        Las fotos se revelan después del festival. La organización revisa cada una y publica una selección: no todas
        salen. Cuando estén listas, aparecen acá.
      </p>

      {fotosSacadas === 0 ? (
        <div className="entra mt-10 border-2 border-texto p-6">
          <p className="titulo text-4xl">Todavía no sacaste ninguna foto</p>
          <Link to="/analogica" className="enlace mt-5">
            Ir a la cámara
          </Link>
        </div>
      ) : (
        <div className="entra mt-10 bg-[#111] p-3 text-[#fffcdc]" style={{ boxShadow: '6px 6px 0 rgba(0,0,0,0.25)' }}>
          <p className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[#fffcdc]/70">
            <span>Rollo {numeroRollo()}</span>
            <span>{nombrePelicula}</span>
          </p>
          <ol className="mt-3 grid grid-cols-5 gap-2" aria-label="Hoja de contactos">
            {Array.from({ length: FOTOS_POR_PERSONA }, (_, i) => {
              const expuesto = i < fotosSacadas
              const c = tira[i]?.c ?? ['#3a2012', '#3a2012']
              return (
                <li key={i}>
                  <div className="relative aspect-[3/4] overflow-hidden" style={{ background: expuesto ? '#120a05' : '#1d1d1d' }}>
                    {expuesto && (
                      <div
                        aria-hidden
                        className="revelando absolute"
                        style={{
                          inset: -10,
                          background: `linear-gradient(${c[0]}, ${c[1]})`,
                          animationDelay: `${i * 260}ms`,
                        }}
                      />
                    )}
                  </div>
                  <span className="mt-1 block text-center font-mono text-[10px] text-[#fffcdc]/60">{dos(i + 1)}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <dl className="mt-10 divide-y divide-linea border-y border-linea font-mono text-[11px] uppercase tracking-[0.14em]">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3">
            <dt className="text-apagado">{k}</dt>
            <dd className="text-right font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <Link to="/analogica" className="enlace mt-10">
        Volver a la cámara
      </Link>
    </Pagina>
  )
}
