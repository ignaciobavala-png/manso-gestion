import { ConFestival } from '../components/Estado'
import { Rotulo, Titulo } from '../components/Mock'
import { lineupPorEscenario, type Artista } from '../lib/festival'

const cuando = (a: Artista) => [a.dia, a.horario].filter(Boolean).join(' · ')

export default function Lineup() {
  return (
    <>
      <Rotulo>02 · Programa</Rotulo>
      <Titulo className="mt-3">Line up</Titulo>

      <ConFestival>
        {(f) => {
          const grupos = lineupPorEscenario(f)
          if (grupos.length === 0)
            return <p className="mt-8 text-apagado">El line up se anuncia pronto.</p>
          return (
            <>
              <div className="mt-8 space-y-10">
                {grupos.map((e) => (
                  <section key={e.id}>
                    <h2 className="border-t border-texto pt-3 text-2xl font-black tracking-tight">{e.nombre}</h2>
                    <ul className="mt-2">
                      {e.artistas.map((a, i) => (
                        <li key={a.id} className="flex items-center gap-3 border-b border-linea py-3">
                          {a.foto_url ? (
                            <img src={a.foto_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-cover" />
                          ) : (
                            <span aria-hidden className="h-12 w-12 shrink-0 border border-linea bg-superficie" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xl font-black leading-tight tracking-tight">
                              {a.b2b && i > 0 && <span className="font-mono text-xs font-normal text-apagado">B2B </span>}
                              {a.nombre}
                              {a.pais && <sup className="ml-1 font-mono text-[10px] font-normal text-apagado">{a.pais}</sup>}
                            </p>
                            {a.origen && <p className="rotulo mt-0.5">{a.origen}</p>}
                          </div>
                          {cuando(a) && <span className="font-mono text-xs text-apagado">{cuando(a)}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <p className="mt-10 border-t border-linea pt-4 text-sm text-apagado">
                Los horarios y las charlas (Sinapsis) se anuncian pronto.
              </p>
            </>
          )
        }}
      </ConFestival>
    </>
  )
}
