/** Marca visible de dato de maqueta: nunca se confunde con info real. */
export function Mock({ children = 'Datos de ejemplo' }: { children?: string }) {
  return (
    <span className="inline-block border border-resalte px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-resalte">
      Mock · {children}
    </span>
  )
}

export function Rotulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`rotulo ${className}`}>{children}</p>
}

export function Titulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`titulo text-[clamp(3rem,16vw,5.5rem)] ${className}`}>{children}</h1>
}

/** Contenedor estándar de una pantalla interna (la home arma sus propios bloques a sangre). */
export function Pagina({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-3xl px-4 pb-16 pt-10 ${className}`}>{children}</div>
}
