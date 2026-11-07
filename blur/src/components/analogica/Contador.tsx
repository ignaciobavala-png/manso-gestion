const ALTO = 1.3 // em

function Rodillo({ n }: { n: number }) {
  return (
    <div className="relative overflow-hidden" style={{ height: `${ALTO}em`, width: '0.72em', lineHeight: `${ALTO}em` }}>
      <div className="transition-transform duration-500 ease-out" style={{ transform: `translateY(${-n * ALTO}em)` }}>
        {Array.from({ length: 10 }, (_, d) => (
          <div key={d} style={{ height: `${ALTO}em` }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Contador de fotos restantes con dos rodillos, como la ventanita de una descartable. */
export function Contador({ valor, tam = 22 }: { valor: number; tam?: number }) {
  const v = Math.max(0, Math.min(99, valor))
  return (
    <div
      role="img"
      aria-label={`Quedan ${v} fotos`}
      className="relative inline-flex border-2 border-[#003009] bg-[#fffcdc] px-2 font-mono font-bold text-[#111]"
      style={{ fontSize: tam, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.35)' }}
    >
      <Rodillo n={Math.floor(v / 10)} />
      <Rodillo n={v % 10} />
      {/* Curvatura del rodillo: sombra arriba y abajo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.38), transparent 32%, transparent 68%, rgba(0,0,0,0.38))' }}
      />
    </div>
  )
}
