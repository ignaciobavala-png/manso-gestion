import { useRef, useState } from 'react'
import { Mock, Pagina, Rotulo, Titulo } from '../components/Mock'
import { PUNTOS, TIPOS_PUNTO, type TipoPunto } from '../lib/mock'

export default function Mapa() {
  const [activos, setActivos] = useState<Set<TipoPunto>>(new Set(TIPOS_PUNTO.map((t) => t.id)))
  const svg = useRef<SVGSVGElement>(null)

  const alternar = (id: TipoPunto) =>
    setActivos((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const descargar = () => {
    if (!svg.current) return
    const xml = new XMLSerializer().serializeToString(svg.current)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mapa-blur.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Pagina>
      <Rotulo>Locación</Rotulo>
      <Titulo className="mt-5">Mapa</Titulo>
      <div className="mt-3"><Mock>Croquis de ejemplo</Mock></div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TIPOS_PUNTO.map((t) => {
          const on = activos.has(t.id)
          return (
            <button
              key={t.id}
              onClick={() => alternar(t.id)}
              aria-pressed={on}
              className={`border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
                on ? 'border-texto bg-texto text-fondo' : 'border-linea text-apagado'
              }`}
            >
              {t.nombre}
            </button>
          )
        })}
      </div>

      <svg
        ref={svg}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Croquis del predio"
        className="mt-4 w-full border border-linea"
      >
        <rect width="100" height="100" fill="#dcdcd4" />
        <path d="M4 4H96V96H4Z" fill="none" stroke="#1a1a1a" strokeOpacity=".35" strokeWidth=".4" strokeDasharray="1.5 1.5" />
        <path d="M12 88 C30 80 40 60 50 48 S75 30 66 30" fill="none" stroke="#005b15" strokeOpacity=".55" strokeWidth="1.2" />
        {PUNTOS.filter((p) => activos.has(p.tipo)).map((p) => {
          const marca = TIPOS_PUNTO.find((t) => t.id === p.tipo)!.marca
          const esc = p.tipo === 'escenario' || p.tipo === 'charlas'
          return (
            <g key={p.id}>
              <rect
                x={p.x - 3.2} y={p.y - 3.2} width="6.4" height="6.4"
                fill={esc ? '#f65200' : '#eaeaea'}
                stroke={esc ? '#f65200' : '#1a1a1a'} strokeWidth=".4"
              />
              <text
                x={p.x} y={p.y + 1} textAnchor="middle" fontSize="2.6" fontWeight="700"
                fontFamily="Space Mono, monospace" fill="#1a1a1a"
              >
                {marca}
              </text>
              {esc && (
                <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="2.4" fontFamily="Helvetica Neue, Arial, sans-serif" fontWeight="700" fill="#1a1a1a">
                  {p.nombre}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <button onClick={descargar} className="btn mt-4 w-full">
        Descargar mapa
      </button>

      <section className="mt-8">
        <Rotulo>Referencias</Rotulo>
        <ul className="mt-2 grid grid-cols-2 gap-x-4">
          {TIPOS_PUNTO.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-linea py-2 text-sm">
              <span className="inline-flex h-6 min-w-6 items-center justify-center border border-texto px-1 font-mono text-[10px] font-bold">
                {t.marca}
              </span>
              {t.nombre}
            </li>
          ))}
        </ul>
      </section>
    </Pagina>
  )
}
