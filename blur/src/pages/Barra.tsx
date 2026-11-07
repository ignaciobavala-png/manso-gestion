import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { IconoProducto } from '../components/barra/IconoProducto'
import { Mock, Pagina, Rotulo, Titulo } from '../components/Mock'
import { MARCA } from '../components/Shell'
import { Textura } from '../components/Textura'
import { CARTA, type Producto } from '../lib/mock'
import { pesos, useBlur, type Pedido } from '../lib/store'
import '../barra.css'

const MONTOS = [10000, 20000, 50000]
const TINTA = '#1a1a1a'
const CREMA = '#fffcdc'

/** Mismo formato que las entradas de Gestión (`manso-ticket|<token>`), con otro prefijo. */
const qrDe = (p: Pedido) => `blur-pedido|${p.id}`
const numero = (p: Pedido) => p.id.slice(0, 6).toUpperCase()
const producto = (id: string) => CARTA.find((x) => x.id === id)

/**
 * AVANCE SIMULADO: no hay backend ni lector en la barra, así que el estado de un pedido
 * se deduce del tiempo desde que se creó. Cuando exista el real, esta función se reemplaza
 * por el estado que llegue del servidor y el resto de la pantalla no cambia.
 */
const PASOS = ['Recibido', 'Preparando', 'Listo para retirar'] as const
const paso = (p: Pedido, ahora: number) => {
  const s = (ahora - p.creado) / 1000
  return s < 8 ? 0 : s < 35 ? 1 : 2
}

/** Reloj de un segundo, solo mientras haya algún pedido que todavía puede cambiar de estado. */
function useAhora(pedidos: Pedido[]) {
  const [ahora, setAhora] = useState(() => Date.now())
  const activo = pedidos.some((p) => paso(p, ahora) < 2)
  useEffect(() => {
    if (!activo) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [activo])
  return ahora
}

const resumen = (p: Pedido) =>
  Object.entries(p.items)
    .map(([id, n]) => `${n}× ${producto(id)?.nombre ?? 'Producto'}`)
    .join(' · ')

function Cantidad({ valor, onMas, onMenos, nombre, grande = false }: { valor: number; onMas: () => void; onMenos: () => void; nombre: string; grande?: boolean }) {
  const caja = grande ? 'h-11 w-11 text-xl' : 'h-9 w-9 text-lg'
  return (
    <div className="flex items-center gap-1 font-mono">
      <button onClick={onMenos} aria-label={`Quitar ${nombre}`} className={`${caja} border-2 border-[#1a1a1a] font-bold leading-none active:bg-[#1a1a1a] active:text-[#fffcdc]`}>−</button>
      <span key={valor} className="barra-pop w-8 text-center text-base font-bold">{valor}</span>
      <button onClick={onMas} aria-label={`Agregar ${nombre}`} className={`${caja} border-2 border-[#1a1a1a] bg-[#1a1a1a] font-bold leading-none text-[#fffcdc] active:opacity-70`}>＋</button>
    </div>
  )
}

function Pulsera({ saldo, onCargar }: { saldo: number; onCargar: (m: number) => void }) {
  return (
    <section style={{ background: TINTA, color: CREMA }} className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <img src={`${MARCA}logo_1_b.svg`} alt="BLUR" className="h-4 w-auto" />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] opacity-70">Barra</span>
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] opacity-70">Tu saldo</p>
      <p key={saldo} className="barra-pop titulo mt-1 inline-block text-6xl">{pesos(saldo)}</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {MONTOS.map((m) => (
          <button key={m} onClick={() => onCargar(m)} className="border-2 border-[#fffcdc] py-3 font-mono text-[13px] font-bold active:bg-[#fffcdc] active:text-[#1a1a1a]">
            + {pesos(m)}
          </button>
        ))}
      </div>
      {/* Muescas laterales: la tarjeta se lee como una pulsera o una entrada. */}
      <span aria-hidden className="absolute -left-2 top-1/2 h-4 w-4 rounded-full bg-[#f65200]" />
      <span aria-hidden className="absolute -right-2 top-1/2 h-4 w-4 rounded-full bg-[#f65200]" />
    </section>
  )
}

function Pasos({ actual }: { actual: number }) {
  return (
    <div>
      <div className="flex gap-1">
        {PASOS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 ${i <= actual ? 'bg-[#1a1a1a]' : 'bg-[#1a1a1a]/20'}`} />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">{PASOS[actual]}</p>
    </div>
  )
}

/** Un pedido como ticket: datos a la izquierda, borde perforado y el estado a la derecha. */
function Ticket({ p, ahora, onVer }: { p: Pedido; ahora: number; onVer: () => void }) {
  const actual = paso(p, ahora)
  const listo = actual === 2
  return (
    <li className="relative flex bg-[#fffcdc] text-[#1a1a1a]">
      <div className="min-w-0 flex-1 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/70">Pedido</p>
        <p className="titulo text-4xl">#{numero(p)}</p>
        <p className="mt-2 text-[14px] leading-snug">{resumen(p)}</p>
        <p className="mt-1 font-mono text-sm font-bold">{pesos(p.total)}</p>
        <div className="mt-3"><Pasos actual={actual} /></div>
      </div>
      <div className="relative flex w-24 shrink-0 flex-col items-center justify-center gap-2 border-l-2 border-dashed border-[#1a1a1a]/40 p-3">
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[#f65200]" />
        <span aria-hidden className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-[#f65200]" />
        <button onClick={onVer} className={`btn !px-2 !py-3 !text-[12px] !bg-[#1a1a1a] !text-[#fffcdc] ${listo ? 'barra-listo' : ''}`}>
          {listo ? 'Retirar' : 'Ver QR'}
        </button>
      </div>
    </li>
  )
}

function Tarjeta({ p, cantidad, onMas, onMenos }: { p: Producto; cantidad: number; onMas: () => void; onMenos: () => void }) {
  return (
    <li className="flex flex-col border-2 border-[#1a1a1a] bg-[#fffcdc] p-3 text-[#1a1a1a]">
      <IconoProducto producto={p} className="h-14 w-14" />
      <p className="mt-3 text-[17px] font-bold leading-tight tracking-tight">{p.nombre}</p>
      <p className="mt-0.5 font-mono text-sm">{pesos(p.precio)}</p>
      <div className="mt-3">
        {cantidad === 0 ? (
          <button onClick={onMas} className="btn w-full !bg-[#1a1a1a] !text-[#fffcdc]">Agregar</button>
        ) : (
          <Cantidad valor={cantidad} onMas={onMas} onMenos={onMenos} nombre={p.nombre} grande />
        )}
      </div>
    </li>
  )
}

export default function Barra() {
  const { saldo, carrito, pedidos, cargar, sumar, totalCarrito, confirmar } = useBlur()
  const ahora = useAhora(pedidos)
  const total = totalCarrito()
  const cuenta = Object.values(carrito).reduce((a, n) => a + n, 0)
  const falta = Math.max(0, total - saldo)

  const [cat, setCat] = useState<'Todo' | Producto['categoria']>('Todo')
  const [abierto, setAbierto] = useState(false)
  const [verId, setVerId] = useState<string | null>(null)

  const categorias = ['Todo', ...new Set(CARTA.map((p) => p.categoria))] as const
  const visibles = CARTA.filter((p) => cat === 'Todo' || p.categoria === cat)
  const verPedido = pedidos.find((p) => p.id === verId) ?? null

  // Con el panel vacío no tiene sentido tenerlo abierto.
  useEffect(() => {
    if (cuenta === 0) setAbierto(false)
  }, [cuenta])

  const pagar = () => {
    const p = confirmar()
    if (!p) return
    setAbierto(false)
    setVerId(p.id)
  }

  return (
    <>
    <div className="textura barra">
      <Textura tipo="pasto" suave />
      <Pagina className={cuenta > 0 ? '!pb-44' : ''}>
        <Rotulo>Pedidos</Rotulo>
        <Titulo className="mt-5">Barra</Titulo>
        <div className="mt-3"><Mock>Sin cobro real · el avance del pedido es simulado</Mock></div>

        <div className="mt-6"><Pulsera saldo={saldo} onCargar={cargar} /></div>

        {pedidos.length > 0 && (
          <section className="mt-10">
            <Rotulo>Para retirar</Rotulo>
            <ul className="mt-4 space-y-4">
              {pedidos.map((p) => <Ticket key={p.id} p={p} ahora={ahora} onVer={() => setVerId(p.id)} />)}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <Rotulo>Carta</Rotulo>
          {/* Categorías fijas debajo de la barra de arriba (h-14): la carta se recorre sin perderlas. */}
          <div role="tablist" aria-label="Categorías" className="sticky top-14 z-30 -mx-4 mt-3 flex gap-2 overflow-x-auto bg-fondo px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categorias.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={cat === c}
                onClick={() => setCat(c)}
                className={`shrink-0 border-2 border-[#1a1a1a] px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.06em] ${
                  cat === c ? 'bg-[#1a1a1a] text-[#fffcdc]' : 'text-[#1a1a1a]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-3">
            {visibles.map((p) => (
              <Tarjeta key={p.id} p={p} cantidad={carrito[p.id] ?? 0} onMas={() => sumar(p.id, 1)} onMenos={() => sumar(p.id, -1)} />
            ))}
          </ul>
        </section>
      </Pagina>
    </div>

    {/* Fuera del contenedor con trazos: ese contenedor crea su propio contexto de apilamiento y
        dejaría el panel y el modal (z-50) por debajo de la barra de navegación (z-40). */}
      {cuenta > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-[calc(3rem+env(safe-area-inset-bottom,0px))] z-30 p-3">
          <button
            onClick={() => setAbierto(true)}
            style={{ background: TINTA, color: CREMA }}
            className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 shadow-[0_6px_0_0_rgba(0,0,0,0.25)] active:translate-y-px"
          >
            <span className="flex items-center gap-3">
              <span key={cuenta} className="barra-pop flex h-8 min-w-8 items-center justify-center rounded-full bg-[#f65200] px-2 font-mono text-sm font-bold text-[#1a1a1a]">{cuenta}</span>
              <span className="font-mono text-[13px] font-bold uppercase tracking-[0.06em]">Ver pedido</span>
            </span>
            <span className="titulo text-2xl">{pesos(total)}</span>
          </button>
        </div>
      )}

      {abierto && (
        <PanelPedido
          carrito={carrito} total={total} saldo={saldo} falta={falta}
          onSumar={sumar} onCargar={cargar} onPagar={pagar} onCerrar={() => setAbierto(false)}
        />
      )}

      {verPedido && <ModalQr pedido={verPedido} ahora={ahora} onCerrar={() => setVerId(null)} />}
    </>
  )
}

function useEscape(onCerrar: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCerrar])
}

function PanelPedido({
  carrito, total, saldo, falta, onSumar, onCargar, onPagar, onCerrar,
}: {
  carrito: Record<string, number>; total: number; saldo: number; falta: number
  onSumar: (id: string, d: number) => void; onCargar: (m: number) => void; onPagar: () => void; onCerrar: () => void
}) {
  useEscape(onCerrar)
  // Lo que falta, redondeado hacia arriba al mil: nadie carga $1.250.
  const aCargar = Math.ceil(falta / 1000) * 1000
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Tu pedido">
      <button aria-label="Cerrar" onClick={onCerrar} className="barra-vela absolute inset-0 bg-black/55" />
      <div className="barra-sube absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto border-t-2 border-[#1a1a1a] bg-[#fffcdc] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-[#1a1a1a]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between">
            <p className="titulo text-4xl">Tu pedido</p>
            <button onClick={onCerrar} aria-label="Cerrar" className="h-10 w-10 border-2 border-[#1a1a1a] text-xl leading-none">×</button>
          </div>

          <ul className="mt-4">
            {Object.entries(carrito).map(([id, n]) => {
              const p = producto(id)
              if (!p) return null
              return (
                <li key={id} className="flex items-center gap-3 border-t border-[#1a1a1a]/25 py-3">
                  <IconoProducto producto={p} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold tracking-tight">{p.nombre}</p>
                    <p className="font-mono text-xs">{pesos(p.precio * n)}</p>
                  </div>
                  <Cantidad valor={n} onMas={() => onSumar(id, 1)} onMenos={() => onSumar(id, -1)} nombre={p.nombre} />
                </li>
              )
            })}
          </ul>

          <div className="mt-2 flex items-baseline justify-between border-t-2 border-[#1a1a1a] pt-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.2em]">Total</span>
            <span className="titulo text-4xl">{pesos(total)}</span>
          </div>
          <p className="mt-1 text-right font-mono text-xs text-[#1a1a1a]/70">Tu saldo: {pesos(saldo)}</p>

          {falta > 0 ? (
            <div className="mt-4 border-2 border-[#1a1a1a] p-3">
              <p className="font-bold">Te faltan {pesos(falta)}</p>
              <button onClick={() => onCargar(aCargar)} className="btn mt-3 w-full !bg-[#1a1a1a] !text-[#fffcdc]">
                Cargar {pesos(aCargar)}
              </button>
            </div>
          ) : (
            <button onClick={onPagar} className="btn mt-4 w-full !bg-[#1a1a1a] !py-4 !text-[#fffcdc]">
              Confirmar y generar QR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalQr({ pedido, ahora, onCerrar }: { pedido: Pedido; ahora: number; onCerrar: () => void }) {
  useEscape(onCerrar)
  const [src, setSrc] = useState('')
  const actual = paso(pedido, ahora)
  useEffect(() => {
    QRCode.toDataURL(qrDe(pedido), { margin: 1, width: 480, color: { dark: TINTA, light: CREMA } }).then(setSrc)
  }, [pedido])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Pedido ${numero(pedido)}`}>
      <button aria-label="Cerrar" onClick={onCerrar} className="barra-vela fixed inset-0 bg-black/60" />
      <div className="relative flex min-h-full items-center justify-center p-5">
        <div className="barra-sube relative w-full max-w-xs bg-[#fffcdc] p-5 text-[#1a1a1a]">
          <span aria-hidden className="absolute -left-2 top-[57%] h-4 w-4 rounded-full bg-[#f65200]" />
          <span aria-hidden className="absolute -right-2 top-[57%] h-4 w-4 rounded-full bg-[#f65200]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/70">
            {actual === 2 ? 'Retiralo en la barra' : 'Tu pedido'}
          </p>
          <p className="titulo mt-1 text-5xl">#{numero(pedido)}</p>
          {src ? <img src={src} alt="QR del pedido" className="mt-4 w-full" /> : <div className="mt-4 aspect-square bg-[#1a1a1a]/10" />}
          <div className="mt-4 border-t-2 border-dashed border-[#1a1a1a]/40 pt-4">
            <p className="text-[14px] leading-snug">{resumen(pedido)}</p>
            <p className="mt-1 font-mono text-sm font-bold">{pesos(pedido.total)}</p>
            <div className="mt-3"><Pasos actual={actual} /></div>
          </div>
          <button onClick={onCerrar} className="btn mt-5 w-full !bg-[#1a1a1a] !text-[#fffcdc]">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
