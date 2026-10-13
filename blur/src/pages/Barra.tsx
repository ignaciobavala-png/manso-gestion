import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Mock, Rotulo, Titulo } from '../components/Mock'
import { CARTA } from '../lib/mock'
import { pesos, useBlur, type Pedido } from '../lib/store'

const MONTOS = [10000, 20000, 50000]

/** Mismo formato que las entradas de Gestión (`manso-ticket|<token>`), con otro prefijo. */
const qrDe = (p: Pedido) => `blur-pedido|${p.id}`

export default function Barra() {
  const { saldo, carrito, pedidos, cargar, sumar, totalCarrito, confirmar } = useBlur()
  const total = totalCarrito()
  const [verPedido, setVerPedido] = useState<Pedido | null>(null)
  const [error, setError] = useState('')

  const pagar = () => {
    const p = confirmar()
    if (!p) return setError('Saldo insuficiente. Cargá más para confirmar.')
    setError('')
    setVerPedido(p)
  }

  const categorias = [...new Set(CARTA.map((p) => p.categoria))]

  return (
    <>
      <Rotulo>04 · Barra</Rotulo>
      <Titulo className="mt-3">Barra</Titulo>
      <div className="mt-3"><Mock>Sin cobro real</Mock></div>

      <section className="mt-8 border border-texto p-4">
        <Rotulo>Tu saldo</Rotulo>
        <p className="titulo mt-2 text-5xl">{pesos(saldo)}</p>
        <div className="mt-4 grid grid-cols-3 gap-px bg-linea">
          {MONTOS.map((m) => (
            <button key={m} onClick={() => cargar(m)} className="bg-fondo py-3 font-mono text-xs hover:text-acento">
              + {pesos(m)}
            </button>
          ))}
        </div>
      </section>

      <p className="mt-6 text-sm text-apagado">
        Armá el pedido ahora y pagalo con tu saldo. Después lo retirás mostrando el QR, antes o durante el festival.
      </p>

      {categorias.map((c) => (
        <section key={c} className="mt-8">
          <Rotulo>{c}</Rotulo>
          <ul className="mt-2">
            {CARTA.filter((p) => p.categoria === c).map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-linea py-3">
                <div>
                  <p className="font-bold">{p.nombre}</p>
                  <p className="font-mono text-xs text-apagado">{pesos(p.precio)}</p>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <button onClick={() => sumar(p.id, -1)} aria-label={`Quitar ${p.nombre}`} className="h-9 w-9 border border-linea hover:text-acento">−</button>
                  <span className="w-5 text-center">{carrito[p.id] ?? 0}</span>
                  <button onClick={() => sumar(p.id, 1)} aria-label={`Agregar ${p.nombre}`} className="h-9 w-9 border border-linea hover:text-acento">＋</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {total > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-texto bg-fondo p-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <Rotulo>Carrito</Rotulo>
              <p className="titulo text-2xl">{pesos(total)}</p>
            </div>
            <button onClick={pagar} className="bg-acento px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-fondo">
              Confirmar y retirar
            </button>
          </div>
          {error && <p className="mx-auto mt-2 max-w-3xl text-sm text-acento">{error}</p>}
        </div>
      )}

      {pedidos.length > 0 && (
        <section className="mt-10">
          <Rotulo>Para retirar</Rotulo>
          <ul className="mt-2">
            {pedidos.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-linea py-3">
                <span className="font-mono text-xs">#{p.id.slice(0, 6)} · {pesos(p.total)}</span>
                <button onClick={() => setVerPedido(p)} className="font-mono text-xs uppercase tracking-[0.2em] text-acento">
                  Ver QR →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {verPedido && <ModalQr pedido={verPedido} onCerrar={() => setVerPedido(null)} />}
    </>
  )
}

function ModalQr({ pedido, onCerrar }: { pedido: Pedido; onCerrar: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(qrDe(pedido), { margin: 1, width: 480, color: { dark: '#1c1410', light: '#fffcdc' } }).then(setSrc)
  }, [pedido])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fondo/95 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-xs">
        <Rotulo>Retiralo en la barra</Rotulo>
        <p className="titulo mt-2 text-4xl">Pedido #{pedido.id.slice(0, 6)}</p>
        {src ? <img src={src} alt="QR del pedido" className="mt-5 w-full" /> : <div className="mt-5 aspect-square bg-superficie" />}
        <button onClick={onCerrar} className="mt-5 w-full border border-texto py-3 font-mono text-xs uppercase tracking-[0.25em] hover:text-acento">
          Cerrar
        </button>
      </div>
    </div>
  )
}
