import { ChevronUp, ChevronDown, Plus, X } from 'lucide-react'
import { ESTADOS_TIPO, entero, tipoVacio, type EstadoTipo, type TipoDraft } from '../lib/tiposEntrada'

const inputClass =
  'w-full px-3 py-2 bg-neutral-900/80 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-terra-500 focus:border-transparent'

export default function TiposEntradaEditor({ tipos, onChange }: { tipos: TipoDraft[]; onChange: (tipos: TipoDraft[]) => void }) {
  const cambiar = (key: string, cambios: Partial<TipoDraft>) =>
    onChange(tipos.map(t => (t.key === key ? { ...t, ...cambios } : t)))

  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= tipos.length) return
    const next = [...tipos]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {tipos.length === 0 && (
        <p className="text-xs text-gray-400">
          Sin tipos, la entrada tiene un solo precio. Agregá tipos para vender
          etapas (Early Bird, General) o packs (x3, x5) con su propio cupo.
        </p>
      )}

      {tipos.map((t, i) => {
        const porUnidad = entero(t.entradasPorUnidad) ?? 1
        return (
          <div key={t.key} className={`border rounded-xl p-3 space-y-2 ${t.activo ? 'border-white/20 bg-neutral-900/40' : 'border-white/10 opacity-60'}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={t.nombre}
                onChange={e => cambiar(t.key, { nombre: e.target.value })}
                placeholder="Nombre (ej: Early Bird)"
                className={inputClass}
              />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                aria-label="Subir" className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === tipos.length - 1}
                aria-label="Bajar" className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronDown size={16} />
              </button>
              {t.ocupadas === 0 && (
                <button type="button" onClick={() => onChange(tipos.filter(x => x.key !== t.key))}
                  aria-label="Quitar tipo" className="p-1.5 text-gray-400 hover:text-red-400">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="text-xs text-gray-400">
                Precio
                {/* number y no texto con coma: "25.000" escrito a mano se
                    leería como 25 pesos. Igual que el precio del evento. */}
                <input type="number" min="0" value={t.precio}
                  onChange={e => cambiar(t.key, { precio: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="0" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                Entradas por unidad
                <input type="number" min="1" value={t.entradasPorUnidad}
                  onChange={e => cambiar(t.key, { entradasPorUnidad: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                Cupo (entradas)
                <input type="number" min="0" value={t.cupo}
                  onChange={e => cambiar(t.key, { cupo: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="Sin tope" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                Máx. por compra
                <input type="number" min="1" value={t.maxPorCompra}
                  onChange={e => cambiar(t.key, { maxPorCompra: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="Sin tope" className={`${inputClass} mt-1`} />
              </label>
            </div>

            <input type="text" value={t.descripcion}
              onChange={e => cambiar(t.key, { descripcion: e.target.value })}
              placeholder={porUnidad > 1 ? `Descripción (ej: incluye ${porUnidad} entradas)` : 'Descripción (opcional)'}
              className={inputClass} />

            <div className="flex items-center gap-2 flex-wrap">
              <select value={t.estado}
                onChange={e => cambiar(t.key, { estado: e.target.value as EstadoTipo })}
                className="px-3 py-2 bg-neutral-900/80 border border-white/20 rounded-lg text-white text-sm [color-scheme:dark]">
                {ESTADOS_TIPO.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
              {t.ocupadas > 0 && (
                <button type="button" onClick={() => cambiar(t.key, { activo: !t.activo })}
                  className="px-3 py-2 text-xs rounded-lg border border-white/20 text-gray-300 hover:text-white">
                  {t.activo ? 'Ocultar' : 'Mostrar'}
                </button>
              )}
              <span className="text-xs text-gray-400">
                {porUnidad > 1 && `Pack: 1 nombre, ${porUnidad} QR. `}
                {t.ocupadas > 0 && `${t.ocupadas} vendidas o reservadas.`}
              </span>
            </div>
          </div>
        )
      })}

      <button type="button" onClick={() => onChange([...tipos, tipoVacio()])}
        className="w-full py-2.5 flex items-center justify-center gap-1.5 text-sm text-gray-300 hover:text-white border border-dashed border-white/20 rounded-xl">
        <Plus size={16} /> Agregar tipo de entrada
      </button>
      {tipos.length > 0 && (
        <p className="text-xs text-gray-400">
          El cupo se cuenta en entradas (un pack x3 usa 3). Cuando se completa,
          el tipo se muestra agotado solo. La capacidad máxima del evento sigue
          valiendo para todos los tipos juntos.
        </p>
      )}
    </div>
  )
}
