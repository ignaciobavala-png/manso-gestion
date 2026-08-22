import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import Background from '../../components/Background'

/**
 * Cartel imprimible con el QR de la app.
 *
 * El cambio de dominio (app.mansoclub.com.ar) no se entera nadie por adentro
 * de la app: quien ya está adentro, ya llegó. El único canal que alcanza a la
 * gente que está en el local es el papel — mesas, barra y puerta. Esta
 * pantalla arma ese papel y lo manda a imprimir.
 */

const DOMINIO_POR_DEFECTO = 'app.mansoclub.com.ar'

const DESTINOS = [
  { path: '', label: 'Inicio', titulo: 'Manso, en tu celular', bajada: 'Entradas, carta y Cowork Day' },
  { path: '/cowork', label: 'Cowork Day', titulo: 'Trabajá un día en Manso', bajada: 'Escritorio, café y wifi por el día' },
  { path: '/carta', label: 'Carta', titulo: 'Nuestra carta', bajada: 'Escaneá y pedí desde la mesa' },
  { path: '/registro', label: 'Eventos', titulo: 'Próximas fechas', bajada: 'Sacá tu entrada desde el celu' },
]

export default function Cartel() {
  const navigate = useNavigate()
  const [dominio, setDominio] = useState(DOMINIO_POR_DEFECTO)
  const [destinoIdx, setDestinoIdx] = useState(0)
  const [qr, setQr] = useState('')

  const destino = DESTINOS[destinoIdx]
  const url = useMemo(
    () => `https://${dominio.replace(/^https?:\/\//, '').replace(/\/$/, '')}${destino.path}`,
    [dominio, destino.path]
  )
  const urlVisible = url.replace(/^https:\/\//, '')

  useEffect(() => {
    let cancelado = false
    QRCode.toDataURL(url, {
      width: 900,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then(data => {
      if (!cancelado) setQr(data)
    })
    return () => { cancelado = true }
  }, [url])

  return (
    <Background>
      {/* Al imprimir sólo sale el cartel: el panel, la nav y los controles
          desaparecen y la hoja queda en blanco con el QR centrado. */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #cartel, #cartel * { visibility: visible !important; }
          #cartel {
            position: absolute; inset: 0; margin: 0;
            width: 100%; min-height: 100vh;
            border: none !important; border-radius: 0 !important;
          }
        }
        @page { margin: 12mm; }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <button
            onClick={() => navigate('/admin/publico')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Cartel para imprimir</h2>
            <p className="text-gray-400 text-sm">QR de la app para pegar en las mesas y la puerta</p>
          </div>
        </div>

        <div className="space-y-4 mb-6 print:hidden">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">¿A dónde lleva el QR?</label>
            <div className="grid grid-cols-2 gap-2">
              {DESTINOS.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setDestinoIdx(i)}
                  className={`rounded-xl py-3 px-3 text-sm font-semibold transition-all active:scale-95 border ${
                    i === destinoIdx
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-white/5 border-white/25 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dominio</label>
            <input
              type="text"
              value={dominio}
              onChange={e => setDominio(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-gray-400 text-xs mt-1.5">
              Se imprime tal cual queda acá: <span className="font-mono">{urlVisible}</span>
            </p>
          </div>
        </div>

        {/* El cartel */}
        <div
          id="cartel"
          className="bg-white rounded-3xl px-10 py-12 flex flex-col items-center text-center"
        >
          <img src="/logo.png" alt="Manso" className="h-16 w-auto object-contain" />

          <h1 className="text-black font-bold text-4xl mt-8 leading-tight">
            {destino.titulo}
          </h1>
          <p className="text-neutral-600 text-lg mt-2">{destino.bajada}</p>

          {qr ? (
            <img src={qr} alt="QR" className="w-64 h-64 mt-8" />
          ) : (
            <div className="w-64 h-64 mt-8 bg-neutral-100 rounded-2xl" />
          )}

          <p className="text-neutral-500 text-sm mt-6 uppercase tracking-widest">
            Escaneá con la cámara
          </p>
          <p className="text-black font-mono font-bold text-2xl mt-2 break-all">
            {urlVisible}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm print:hidden"
        >
          Imprimir cartel →
        </button>
        <p className="text-gray-400 text-xs text-center mt-3 print:hidden">
          Desde el celular, "Imprimir" también permite guardarlo como PDF para
          mandarlo por WhatsApp a la imprenta.
        </p>
      </div>
    </Background>
  )
}
