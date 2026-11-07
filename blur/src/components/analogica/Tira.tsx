import { useEffect, useRef } from 'react'
import { FOTOS_POR_PERSONA } from '../../lib/mock'
import type { Frame } from '../../lib/store'

const ANCHO = 52
const SEP = 4

const perforaciones = {
  height: 6,
  background: 'repeating-linear-gradient(90deg, #e9d9a6 0 8px, transparent 8px 15px)',
} as const

/**
 * Tira de negativos: un fotograma por foto del rollo. Los ya expuestos muestran una
 * imagen latente (dos colores borrosos, nunca la foto); el siguiente late; el resto
 * está virgen. Se ve cuánto gastaste, no qué sacaste.
 */
export function Tira({ frames, sacadas }: { frames: Frame[]; sacadas: number }) {
  const scroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroll.current
    if (!el) return
    const objetivo = Math.min(sacadas, FOTOS_POR_PERSONA - 1) * (ANCHO + SEP) - el.clientWidth / 2 + ANCHO / 2
    el.scrollTo({ left: Math.max(0, objetivo), behavior: 'smooth' })
  }, [sacadas])

  return (
    <div
      ref={scroll}
      className="sin-barra -mx-4 overflow-x-auto px-4"
      aria-label="Tira de negativos"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)' }}
    >
      <ol
        className="inline-flex min-w-full flex-col gap-1.5 bg-[#24120a] py-2"
        style={{ width: FOTOS_POR_PERSONA * (ANCHO + SEP) + 24 }}
      >
        <li aria-hidden style={perforaciones} className="mx-1" />
        <li className="px-3">
          <ul className="flex" style={{ gap: SEP }}>
            {Array.from({ length: FOTOS_POR_PERSONA }, (_, i) => {
              const expuesto = i < sacadas
              const siguiente = i === sacadas
              const frame = frames[i]
              return (
                <li key={`${i}-${expuesto}`} className="flex flex-col items-center gap-1">
                  <div
                    className={`relative overflow-hidden ${siguiente ? 'pulso' : ''} ${expuesto ? 'entra' : ''}`}
                    style={{
                      width: ANCHO,
                      height: 68,
                      background: expuesto ? '#120a05' : '#4a2a14',
                      outline: siguiente ? '1px solid #f65200' : 'none',
                      animationDelay: expuesto && i === sacadas - 1 ? '0ms' : `${i * 35}ms`,
                    }}
                  >
                    {expuesto && (
                      <div
                        aria-hidden
                        className="latente absolute"
                        style={{
                          inset: -8,
                          background: `linear-gradient(${frame?.c[0] ?? '#3a2012'}, ${frame?.c[1] ?? '#3a2012'})`,
                          animationDelay: i === sacadas - 1 ? '120ms' : '0ms',
                        }}
                      />
                    )}
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#f65200]">{i + 1}</span>
                </li>
              )
            })}
          </ul>
        </li>
        <li aria-hidden style={perforaciones} className="mx-1" />
      </ol>
    </div>
  )
}
