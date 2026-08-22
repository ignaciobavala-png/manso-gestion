import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/compressImage'
import { useVenueConfig, sincronizarVenueConfig } from '../../store/useVenueConfig'
import {
  ICONOS_SUGERIDOS,
  nuevaTarjeta,
  type CoworkLanding,
  type TarjetaIncluye,
} from '../../lib/coworkLanding'

/**
 * Editor de la presentación de /cowork.
 *
 * Se guarda entero como un JSONB en venue_config, así que un cambio se ve en
 * la landing al instante — está en el mismo store con realtime que las
 * perillas. Nada de esto necesita un deploy.
 */

export default function CoworkPresentacion() {
  useEffect(() => { sincronizarVenueConfig() }, [])
  const guardado = useVenueConfig(s => s.coworkLanding)
  const cargado = useVenueConfig(s => s.cargado)

  const [borrador, setBorrador] = useState<CoworkLanding>(guardado)
  const [tocado, setTocado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const inputPortada = useRef<HTMLInputElement>(null)

  // Mientras no haya cambios sin guardar, el borrador sigue a lo guardado: si
  // alguien edita desde otro dispositivo, esta pantalla se actualiza. Si hay
  // cambios a medio escribir, no se pisan.
  useEffect(() => {
    if (!tocado) setBorrador(guardado)
  }, [guardado, tocado])

  const editar = (cambios: Partial<CoworkLanding>) => {
    setBorrador(prev => ({ ...prev, ...cambios }))
    setTocado(true)
    setOk(false)
  }

  const editarTarjeta = (id: string, cambios: Partial<TarjetaIncluye>) => {
    editar({
      incluye: borrador.incluye.map(t => (t.id === id ? { ...t, ...cambios } : t)),
    })
  }

  const moverTarjeta = (indice: number, delta: number) => {
    const destino = indice + delta
    if (destino < 0 || destino >= borrador.incluye.length) return
    const copia = [...borrador.incluye]
    const [fila] = copia.splice(indice, 1)
    copia.splice(destino, 0, fila)
    editar({ incluye: copia })
  }

  const guardar = async (valores: CoworkLanding = borrador) => {
    if (guardando) return
    setGuardando(true)
    setError('')
    setOk(false)

    // Las tarjetas sin título no aportan nada en pantalla y ensucian la grilla.
    const limpio: CoworkLanding = {
      ...valores,
      titulo: valores.titulo.trim(),
      leyenda: valores.leyenda.trim(),
      notaDatos: valores.notaDatos.trim(),
      incluye: valores.incluye
        .filter(t => t.titulo.trim().length > 0)
        .map(t => ({ ...t, titulo: t.titulo.trim(), detalle: t.detalle.trim() })),
    }

    const { data, error: err } = await supabase
      .from('venue_config')
      .update({ cowork_landing: limpio })
      .eq('id', 1)
      .select('id')

    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.')
    } else if (!data || data.length === 0) {
      setError('No se pudo guardar: tu usuario no tiene permiso para cambiar esto.')
    } else {
      await useVenueConfig.getState().cargar()
      setTocado(false)
      setOk(true)
    }
    setGuardando(false)
  }

  const subirPortada = async (file: File) => {
    if (subiendo) return
    setSubiendo(true)
    setError('')
    try {
      const comprimida = await compressImage(file)
      const path = 'app/cowork-portada.jpg'

      const { error: storageError } = await supabase.storage
        .from('event-flyers')
        .upload(path, comprimida, { upsert: true, contentType: 'image/jpeg' })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from('event-flyers')
        .getPublicUrl(path)

      // El ?t= rompe la caché: se sobreescribe siempre el mismo archivo y sin
      // esto seguiría mostrándose la portada anterior.
      const portadaUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const conPortada = { ...borrador, portadaUrl }
      setBorrador(conPortada)
      // La imagen se guarda sola: subir y que no quede es desconcertante.
      await guardar(conPortada)
    } catch {
      setError('No se pudo subir la portada. Intentá de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  if (!cargado) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
      </div>
    )
  }

  const campo = 'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-gray-500 text-sm leading-relaxed">
          Lo que ve la gente al entrar a <span className="font-mono text-gray-400">/cowork</span>.
          Se guarda al instante, sin deploy.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
          <input
            type="text"
            value={borrador.titulo}
            onChange={e => editar({ titulo: e.target.value })}
            className={campo}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Leyenda</label>
          <textarea
            value={borrador.leyenda}
            onChange={e => editar({ leyenda: e.target.value })}
            rows={3}
            className={`${campo} resize-y`}
          />
          <p className="text-gray-600 text-xs mt-1">
            Va debajo del título. Dos o tres líneas se leen mejor que un párrafo.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Por qué pedimos los datos
          </label>
          <textarea
            value={borrador.notaDatos}
            onChange={e => editar({ notaDatos: e.target.value })}
            rows={2}
            className={`${campo} resize-y`}
          />
          <p className="text-gray-600 text-xs mt-1">
            Aparece dos veces: al pie de la landing y arriba de los campos de
            teléfono e Instagram al reservar.
          </p>
        </div>
      </div>

      {/* Portada */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Portada</label>
        <div className="flex gap-4 items-start">
          <div
            className="w-32 h-20 rounded-xl border border-white/15 flex-shrink-0 bg-neutral-900 flex items-center justify-center"
            style={borrador.portadaUrl ? {
              backgroundImage: `url(${borrador.portadaUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
          >
            {!borrador.portadaUrl && <span className="text-gray-600 text-xs">sin portada</span>}
          </div>
          <div className="flex-1 space-y-2">
            <button
              onClick={() => inputPortada.current?.click()}
              disabled={subiendo || guardando}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
            >
              {subiendo ? 'Subiendo...' : borrador.portadaUrl ? 'Cambiar la portada' : 'Subir una portada'}
            </button>
            {borrador.portadaUrl && (
              <button
                onClick={() => guardar({ ...borrador, portadaUrl: null })}
                disabled={subiendo || guardando}
                className="w-full text-gray-500 hover:text-gray-300 disabled:opacity-60 text-sm underline underline-offset-2 transition-colors"
              >
                Quitar la portada
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputPortada}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={ev => {
            const file = ev.target.files?.[0]
            if (file) subirPortada(file)
            ev.target.value = ''
          }}
        />
      </div>

      {/* Tarjetas de "qué incluye" */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300">Qué incluye el pase</label>
          <p className="text-gray-600 text-xs mt-1">
            Las tarjetas de la landing. Si no cargás ninguna, la sección no
            aparece — mejor eso que poner algo que no es cierto.
          </p>
        </div>

        {borrador.incluye.map((tarjeta, i) => (
          <div key={tarjeta.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tarjeta.icono}
                onChange={e => editarTarjeta(tarjeta.id, { icono: e.target.value })}
                className="w-14 bg-white/10 border border-white/20 rounded-xl px-2 py-2.5 text-center text-lg focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={tarjeta.titulo}
                onChange={e => editarTarjeta(tarjeta.id, { titulo: e.target.value })}
                placeholder="Escritorio por el día"
                className={`${campo} flex-1`}
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moverTarjeta(i, -1)}
                  disabled={i === 0}
                  className="w-7 h-6 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-gray-300 text-xs transition-colors"
                >
                  ↑
                </button>
                <button
                  onClick={() => moverTarjeta(i, 1)}
                  disabled={i === borrador.incluye.length - 1}
                  className="w-7 h-6 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-gray-300 text-xs transition-colors"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => editar({ incluye: borrador.incluye.filter(t => t.id !== tarjeta.id) })}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-400 transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={tarjeta.detalle}
              onChange={e => editarTarjeta(tarjeta.id, { detalle: e.target.value })}
              placeholder="De 9 a 18, sin reserva de lugar fijo"
              className={campo}
            />

            <div className="flex flex-wrap gap-1.5">
              {ICONOS_SUGERIDOS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => editarTarjeta(tarjeta.id, { icono: emoji })}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={() => editar({ incluye: [...borrador.incluye, nuevaTarjeta()] })}
          className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl py-3 text-gray-400 hover:text-gray-200 transition-colors text-sm"
        >
          <span className="text-lg">+</span> Agregar tarjeta
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3 sticky bottom-20 bg-black/80 backdrop-blur-sm py-3 -mx-1 px-1 rounded-xl">
        <button
          onClick={() => guardar()}
          disabled={!tocado || guardando || subiendo}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {guardando ? 'Guardando...' : tocado ? 'Guardar cambios' : ok ? 'Guardado ✓' : 'Sin cambios'}
        </button>
        <button
          onClick={() => window.open('/cowork', '_blank', 'noopener,noreferrer')}
          className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold px-3 transition-colors"
        >
          Ver la página ↗
        </button>
      </div>
    </div>
  )
}
