import { useState } from 'react'
import { MapaIsla } from '../components/MapaIsla'
import { ConFestival } from '../components/Estado'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { Textura } from '../components/Textura'
import { useFestival, type Lancha } from '../lib/festival'
import { ID_LLEGADA, PUNTOS, TIPOS_PUNTO, type TipoPunto } from '../lib/mapa'

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

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

/** Primera parte de la pantalla: cuándo sale y vuelve cada lancha. Los datos los carga la organización en manso-club. */
function Lanchas() {
  return (
    <section id="lanchas">
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
    </section>
  )
}

/** Segunda parte: el predio, con filtros y la ficha de cada punto. */
function Predio() {
  const [activos, setActivos] = useState<Set<TipoPunto>>(new Set(TIPOS_PUNTO.map((t) => t.id)))
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [destino, setDestino] = useState<string | null>(null)
  const festival = useFestival()

  const alternar = (id: TipoPunto) =>
    setActivos((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const visibles = PUNTOS.filter((p) => activos.has(p.tipo))
  const sel = PUNTOS.find((p) => p.id === seleccionado)
  const meta = PUNTOS.find((p) => p.id === destino)
  const tipo = sel && TIPOS_PUNTO.find((t) => t.id === sel.tipo)
  // Si el punto es un escenario con spot cargado en manso-club, la ficha muestra su foto y descripción.
  const spot =
    sel && 'data' in festival ? festival.data.spots.find((s) => sinTildes(s.titulo) === sinTildes(sel.nombre)) : undefined

  return (
    <section id="predio" className="mt-16">
      <Rotulo>Locación</Rotulo>
      <Titulo className="mt-5">Predio</Titulo>

      {/* Filtros: son también la leyenda, cada uno con la marca del punto en el mapa. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TIPOS_PUNTO.map((t) => {
          const on = activos.has(t.id)
          return (
            <button
              key={t.id}
              onClick={() => alternar(t.id)}
              aria-pressed={on}
              className={`flex items-center border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
                on ? 'border-texto bg-texto text-fondo' : 'border-linea text-apagado'
              }`}
            >
              {t.nombre}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <MapaIsla puntos={visibles} seleccionado={seleccionado} onSelect={setSeleccionado} destino={destino}>
          {meta && (
            <div data-ignora className="absolute left-[6.5rem] top-3 z-20 flex max-w-[calc(100%-11.5rem)] items-center gap-2 bg-[#1a1a1a] py-1.5 pl-3 pr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#ffa7fe]">
              <span className="truncate">Destino: {meta.nombre}</span>
              <button type="button" onClick={() => setDestino(null)} aria-label="Quitar destino" className="h-7 w-7 shrink-0 text-base text-[#fffcdc]">×</button>
            </div>
          )}

          {sel && (
            <div data-ignora className="absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto border-t-2 border-[#1a1a1a] bg-[#eaeaea] p-4 text-[#1a1a1a]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/70">{tipo?.nombre}</p>
                  <p className="titulo mt-1 text-3xl">{sel.nombre}</p>
                </div>
                <button type="button" onClick={() => setSeleccionado(null)} aria-label="Cerrar" className="h-9 w-9 shrink-0 border-2 border-[#1a1a1a] text-lg leading-none">×</button>
              </div>

              {spot?.fotos[0] && <img src={spot.fotos[0]} alt="" loading="lazy" className="mt-3 aspect-[16/9] w-full object-cover" />}
              {sel.info && <p className="mt-3 text-[15px] leading-snug">{sel.info}</p>}
              {spot?.descripcion && <p className="mt-3 text-[15px] leading-snug">{spot.descripcion}</p>}

              {sel.id !== ID_LLEGADA && (
                <button
                  type="button"
                  onClick={() => setDestino(destino === sel.id ? null : sel.id)}
                  className="btn mt-4 !bg-[#1a1a1a] !text-[#fffcdc]"
                >
                  {destino === sel.id ? 'Quitar destino' : 'Ir acá'}
                </button>
              )}
            </div>
          )}
        </MapaIsla>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-apagado">
          Arrastrá para recorrer · pellizcá para acercar · tocá un punto
        </p>
      </div>
    </section>
  )
}

/** Una sola pantalla para llegar: primero las lanchas (cuándo y de dónde salen), después el predio. */
export default function Mapa() {
  return (
    <div className="textura">
      <Textura tipo="pasto" suave />
      <Pagina>
        <Lanchas />
        <Predio />
      </Pagina>
    </div>
  )
}
