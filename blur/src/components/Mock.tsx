/** Marca visible de dato de maqueta: nunca se confunde con info real. */
export function Mock({ children = 'Datos de ejemplo' }: { children?: string }) {
  return (
    <span className="inline-block border border-resalte px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-resalte">
      Mock · {children}
    </span>
  )
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="rotulo">{children}</p>
}

export function Titulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`titulo text-[clamp(2.4rem,13vw,4.5rem)] ${className}`}>{children}</h1>
}
