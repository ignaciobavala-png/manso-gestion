import { ConFestival } from '../components/Estado'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import type { Lancha } from '../lib/festival'

/** Si el regreso es menor que la salida, es pasada la medianoche (el festival termina a las 04). */
const deMadrugada = (l: Lancha) => !!l.salida && !!l.regreso && l.regreso < l.salida

function Hora({ rotulo, valor, nota }: { rotulo: string; valor: string | null; nota?: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-apagado">{rotulo}</p>
      {valor ? (
        <p className="titulo mt-1 text-5xl">{valor}</p>
      ) : (
        <p className="mt-2 font-mono text-sm uppercase tracking-[0.1em] text-apagado">A confirmar</p>
      )}
      {valor && nota && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-apagado">{nota}</p>}
    </div>
  )
}

/**
 * Los viajes en lancha, tal cual los carga la organización en el panel de manso-club
 * (festival_lanchas). Nombre y nota se muestran literales; las horas, en 24 h.
 */
export default function Lanchas() {
  return (
    <Pagina>
      <Rotulo>Ida y vuelta</Rotulo>
      <Titulo className="mt-5">Lanchas</Titulo>

      <ConFestival>
        {({ lanchas }) =>
          lanchas.length === 0 ? (
            <p className="mt-10 text-apagado">Los horarios de las lanchas se anuncian pronto.</p>
          ) : (
            <ul className="mt-10">
              {lanchas.map((l) => (
                <li key={l.id} className="border-t border-texto py-6">
                  <p className="rotulo">{l.nombre}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Hora rotulo="Sale" valor={l.salida} />
                    <Hora rotulo="Vuelve" valor={l.regreso} nota={deMadrugada(l) ? 'De madrugada' : undefined} />
                  </div>
                  {l.nota && <p className="mt-4 text-[15px] leading-snug">{l.nota}</p>}
                </li>
              ))}
            </ul>
          )
        }
      </ConFestival>
    </Pagina>
  )
}
