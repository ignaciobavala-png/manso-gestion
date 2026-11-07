import { useState } from 'react'
import { FILTROS, filtroPorId, type Filtro } from '../../lib/filtros'
import { FOTOS_POR_PERSONA } from '../../lib/mock'

type Forma = 'diagonal' | 'escalon' | 'cruz' | 'rayas' | 'sol' | 'ninguna'
interface Caja {
  fondo: string
  tinta: string
  color: string
  forma: Forma
}

/** La gráfica de cada caja vive acá (la receta de color de la foto, en lib/filtros.ts). */
const CAJAS: Record<string, Caja> = {
  gold: { fondo: '#ffb400', tinta: '#003009', color: '#f65200', forma: 'diagonal' },
  'tri-x': { fondo: '#f4f2ea', tinta: '#111111', color: '#111111', forma: 'escalon' },
  polaroid: { fondo: 'linear-gradient(#f7c6cf, #b7d6ea)', tinta: '#003009', color: '#003009', forma: 'ninguna' },
  cross: { fondo: '#0f8a7e', tinta: '#fffcdc', color: '#ff2d9a', forma: 'cruz' },
  fuji: { fondo: '#0b5a1a', tinta: '#fffcdc', color: '#fffcdc', forma: 'rayas' },
  noche: { fondo: '#14234f', tinta: '#f65200', color: '#f65200', forma: 'sol' },
  limpio: { fondo: '#fffcdc', tinta: '#003009', color: '#003009', forma: 'ninguna' },
}

function Forma({ caja }: { caja: Caja }) {
  const base = { position: 'absolute', left: 0, right: 0, bottom: 0, background: caja.color } as const
  switch (caja.forma) {
    case 'diagonal':
      return <div style={{ ...base, height: '55%', clipPath: 'polygon(0 100%, 100% 35%, 100% 100%)' }} />
    case 'escalon':
      return <div style={{ ...base, height: '40%', clipPath: 'polygon(0 0, 55% 0, 55% 28%, 100% 28%, 100% 100%, 0 100%)' }} />
    case 'cruz':
      return <div style={{ ...base, height: '48%', clipPath: 'polygon(0 45%, 45% 45%, 45% 0, 100% 0, 100% 100%, 0 100%)' }} />
    case 'rayas':
      return (
        <div
          style={{
            ...base,
            height: '30%',
            background: `repeating-linear-gradient(${caja.color} 0 6px, transparent 6px 16px)`,
          }}
        />
      )
    case 'sol':
      return (
        <div
          style={{
            position: 'absolute',
            left: '6%',
            bottom: '-32%',
            width: '88%',
            aspectRatio: '1',
            borderRadius: '50%',
            background: caja.color,
          }}
        />
      )
    default:
      return null
  }
}

/** Caja de película, dibujada en CSS (sin imágenes: pesa cero). `tam` es el ancho en px. */
export function Cartucho({ filtro, tam = 132 }: { filtro: Filtro; tam?: number }) {
  const caja = CAJAS[filtro.id] ?? CAJAS.limpio
  const [nombre, ...resto] = filtro.nombre.split(' ')
  return (
    <div
      aria-hidden
      className="relative shrink-0 overflow-hidden"
      style={{
        width: tam,
        height: tam * 2.05,
        background: caja.fondo,
        color: caja.tinta,
        boxShadow: '5px 5px 0 rgba(0,0,0,0.38)',
      }}
    >
      <Forma caja={caja} />
      <div className="relative" style={{ padding: tam * 0.1 }}>
        <p className="font-mono uppercase leading-tight tracking-[0.1em]" style={{ fontSize: tam * 0.075 }}>
          35 mm
          <br />
          Negativo
        </p>
        <p className="titulo mt-[0.5em]" style={{ fontSize: tam * 0.24, lineHeight: 0.95 }}>
          {nombre}
          {resto.length > 0 && (
            <>
              <br />
              {resto.join(' ')}
            </>
          )}
        </p>
      </div>
      <p
        className="absolute font-mono font-bold uppercase"
        style={{ left: tam * 0.1, bottom: tam * 0.09, fontSize: tam * 0.085, color: caja.forma === 'ninguna' ? caja.tinta : '#fffcdc', mixBlendMode: 'normal' }}
      >
        {FOTOS_POR_PERSONA} exp
      </p>
    </div>
  )
}

/**
 * Carrusel de cajas para elegir la película. Se usa al cargar el rollo y, una sola
 * vez, para cambiarla a mitad de rollo (por eso `onCancelar` es opcional).
 */
export function ElegirPelicula({
  inicial,
  boton,
  onConfirmar,
  onCancelar,
}: {
  inicial: string
  boton: string
  onConfirmar: (id: string) => void
  onCancelar?: () => void
}) {
  const [id, setId] = useState(inicial)
  const f = filtroPorId(id)
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Película"
        className="sin-barra -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-66px)] pb-8 pt-10"
      >
        {FILTROS.map((x) => {
          const activa = x.id === id
          return (
            <button
              key={x.id}
              role="radio"
              aria-checked={activa}
              aria-label={`${x.nombre}. ${x.nota}`}
              onClick={(e) => {
                setId(x.id)
                e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
              }}
              className="shrink-0 snap-center transition-[transform,opacity] duration-500"
              style={{
                transform: activa ? 'translateY(-12px) scale(1.06)' : 'scale(0.9)',
                opacity: activa ? 1 : 0.5,
                transitionTimingFunction: 'var(--ease-hard)',
              }}
            >
              <div className={activa ? 'flota' : ''}>
                <Cartucho filtro={x} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Con key, al cambiar de película el nombre entra de nuevo. */}
      <div key={f.id} className="entra">
        <p className="titulo text-5xl">{f.nombre}</p>
        <p className="mt-2 text-sm text-apagado">{f.nota}</p>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button className="btn" onClick={() => onConfirmar(id)}>
          {boton}
        </button>
        {onCancelar && (
          <button className="btn-borde" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
