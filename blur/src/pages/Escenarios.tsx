import { ConFestival } from '../components/Estado'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { lineupPorEscenario } from '../lib/festival'

export default function Escenarios() {
  return (
    <div className="textura textura-color">
      <Pagina>
        <Rotulo>Spots</Rotulo>
        <Titulo className="mt-5">Escenarios</Titulo>

        <ConFestival>
          {(f) => {
            const grupos = lineupPorEscenario(f)
            const spotDe = (nombre: string) =>
              f.spots.find((s) => s.titulo.trim().toLowerCase() === nombre.trim().toLowerCase())
            if (grupos.length === 0) return <p className="mt-8 text-apagado">Los escenarios se anuncian pronto.</p>
            return (
              <div className="mt-12 space-y-14">
                {grupos.map((e) => {
                  const spot = spotDe(e.nombre)
                  const [portada, ...resto] = spot?.fotos ?? []
                  return (
                    <section key={e.id}>
                      <h2 className="nombre">{e.nombre}</h2>

                      {/* Mosaico como el de Locación: una foto grande y el resto de a dos, sin separación. */}
                      {portada && (
                        <div className="mt-4 grid grid-cols-2">
                          <img src={portada} alt={e.nombre} loading="lazy" className="col-span-2 aspect-[4/3] w-full object-cover" />
                          {resto.slice(0, 4).map((src) => (
                            <img key={src} src={src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                          ))}
                        </div>
                      )}

                      {spot?.descripcion && <p className="mt-4 text-[15px] leading-snug">{spot.descripcion}</p>}

                      <ul className="mt-4">
                        {e.artistas.map((a) => (
                          <li key={a.id} className="flex justify-between gap-3 border-t border-linea py-2.5">
                            <span className="font-bold tracking-tight">{a.nombre}</span>
                            <span className="font-mono text-[12px] uppercase text-apagado">
                              {[a.dia, a.horario].filter(Boolean).join(' · ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )
          }}
        </ConFestival>
      </Pagina>
    </div>
  )
}
