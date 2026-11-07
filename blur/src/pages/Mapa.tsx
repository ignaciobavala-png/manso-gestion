import { useState } from 'react'
import { MapaIsla } from '../components/MapaIsla'
import { Mock, Pagina, Rotulo, Titulo } from '../components/Mock'
import { Selector, VISTAS_MAPA } from '../components/Selector'
import { useFestival } from '../lib/festival'
import { ID_LLEGADA, PUNTOS, TIPOS_PUNTO, type TipoPunto } from '../lib/mapa'

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export default function Mapa() {
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
    <Pagina>
      <Selector items={VISTAS_MAPA} />
      <Rotulo>Locación</Rotulo>
      <Titulo className="mt-5">Mapa</Titulo>
      <div className="mt-3">
        <Mock>Isla de ejemplo, el dibujo real lo carga la organización</Mock>
      </div>

      {/* Filtros: son también la leyenda, cada uno con la marca del punto en el mapa. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TIPOS_PUNTO.map((t) => {
          const on = activos.has(t.id)
          return (
            <button
              key={t.id}
              onClick={() => alternar(t.id)}
              aria-pressed={on}
              className={`flex items-center gap-2 border px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
                on ? 'border-texto bg-texto text-fondo' : 'border-linea text-apagado'
              }`}
            >
              <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fondo px-1 text-[9px] font-bold text-texto">
                {t.marca}
              </span>
              {t.nombre}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <MapaIsla puntos={visibles} seleccionado={seleccionado} onSelect={setSeleccionado} destino={destino}>
          {meta && (
            <div data-ignora className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-5.5rem)] items-center gap-2 bg-[#1a1a1a] py-1.5 pl-3 pr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#ffa7fe]">
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
    </Pagina>
  )
}
