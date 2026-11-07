/**
 * Sobre de laboratorio con el que se cierra el rollo. Todo en CSS y con secuencia:
 * entra el sobre, se cierra la solapa, asoma el rollo y cae el sello.
 */
export function Sobre({ numero }: { numero: string }) {
  return (
    <div
      className="entra relative mx-auto mt-16 w-full max-w-[340px]"
      style={{ aspectRatio: '1 / 0.95', perspective: 900 }}
    >
      {/* Rollo asomando: va antes que el sobre para que quede detrás. */}
      <div
        aria-hidden
        className="absolute -top-9 right-9 h-14 w-11 rounded-t-md bg-[#111]"
        style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', animation: 'asoma 800ms var(--ease-hard) 900ms backwards' }}
      >
        <div className="mx-auto mt-4 h-9 w-9 bg-[#f65200]" />
      </div>

      <div className="absolute inset-0 bg-[#eadba5]" style={{ boxShadow: '6px 6px 0 rgba(0,0,0,0.38)' }}>
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[46%] bg-[#dcca8e]"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            transformOrigin: 'top',
            animation: 'tapa 900ms var(--ease-hard) 350ms backwards',
          }}
        />
        <div
          aria-hidden
          className="entra absolute left-[calc(50%-14px)] top-[41%] h-7 w-7 rounded-full border-2 border-[#003009] bg-[#f65200]"
          style={{ animationDelay: '1100ms' }}
        />
        <div
          className="absolute inset-x-5 bottom-6 -rotate-3 border-2 border-[#b83a00] p-3 font-mono text-[#b83a00]"
          style={{ animation: 'sello 600ms cubic-bezier(0.2, 0.9, 0.3, 1) 1400ms both' }}
        >
          <p className="text-xl font-bold tracking-[0.08em]">ROLLO Nº {numero}</p>
          <div className="my-2 h-[2px] bg-[#b83a00]" />
          <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.12em]">
            Entregado a la organización
            <br />
            BLUR 2026
          </p>
        </div>
      </div>
    </div>
  )
}
