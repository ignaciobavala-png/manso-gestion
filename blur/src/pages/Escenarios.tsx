import { ConFestival } from '../components/Estado'
import { Rotulo, Titulo } from '../components/Mock'
import { lineupPorEscenario } from '../lib/festival'

export default function Escenarios() {
  return (
    <>
      <Rotulo>03 · Spots</Rotulo>
      <Titulo className="mt-3">Escenarios</Titulo>

      <ConFestival>
        {(f) => {
          const grupos = lineupPorEscenario(f)
          const spotDe = (nombre: string) => f.spots.find((s) => s.titulo.trim().toLowerCase() === nombre.trim().toLowerCase())
          if (grupos.length === 0) return <p className="mt-8 text-apagado">Los escenarios se anuncian pronto.</p>
          return (
            <div className="mt-8 space-y-10">
              {grupos.map((e, i) => {
                const spot = spotDe(e.nombre)
                return (
                  <section key={e.id} className={i % 2 ? 'ml-4' : 'mr-4'}>
                    <h2 className="border-t border-texto pt-3 text-3xl font-black tracking-tight">{e.nombre}</h2>
                    {spot?.fotos[0] && (
                      <img src={spot.fotos[0]} alt={e.nombre} loading="lazy" className="mt-3 aspect-[4/3] w-full object-cover" />
                    )}
                    {spot?.descripcion && <p className="mt-2 text-sm text-apagado">{spot.descripcion}</p>}
                    <ul className="mt-3">
                      {e.artistas.map((a) => (
                        <li key={a.id} className="flex justify-between gap-3 border-b border-linea py-2.5 text-sm">
                          <span className="font-bold">{a.nombre}</span>
                          <span className="font-mono text-xs text-apagado">{[a.dia, a.horario].filter(Boolean).join(' · ')}</span>
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
    </>
  )
}
