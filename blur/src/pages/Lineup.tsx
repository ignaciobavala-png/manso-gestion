import { ConFestival } from '../components/Estado'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { Selector, VISTAS_LINEUP } from '../components/Selector'
import { Textura } from '../components/Textura'
import { Nombres } from '../components/Nombres'
import { lineupPorEscenario } from '../lib/festival'

export default function Lineup() {
  return (
    <div className="textura">
      <Textura tipo="pasto" />
      <Pagina>
        <Selector items={VISTAS_LINEUP} />
        <Rotulo>Programa</Rotulo>
        <Titulo className="mt-5">Line up</Titulo>

        <ConFestival>
          {(f) => {
            const grupos = lineupPorEscenario(f)
            if (grupos.length === 0)
              return <p className="mt-8 text-apagado">El line up se anuncia pronto.</p>
            return (
              <>
                <div className="mt-12 space-y-12">
                  {grupos.map((e) => (
                    <section key={e.id}>
                      <Rotulo>{e.nombre}</Rotulo>
                      <div className="mt-5">
                        <Nombres artistas={e.artistas} />
                      </div>
                    </section>
                  ))}
                </div>
                <p className="mt-14 border-t border-linea pt-4 font-mono text-[12px] uppercase text-apagado">
                  Los horarios y las charlas (Sinapsis) se anuncian pronto.
                </p>
              </>
            )
          }}
        </ConFestival>
      </Pagina>
    </div>
  )
}
