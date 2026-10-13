import { useCallback, useEffect, useRef, useState } from 'react'
import { Mock, Rotulo, Titulo } from '../components/Mock'
import { FOTOS_POR_PERSONA } from '../lib/mock'
import { FILTROS, aplicarFiltro, filtroPorId } from '../lib/filtros'
import { RolloCompleto, SUBIDA_REAL, subirFoto } from '../lib/fotos'
import { useBlur } from '../lib/store'

/** Lado largo máximo de la foto guardada: alcanza para pantalla y pesa poco. */
const LADO_MAX = 1600

export default function Analogica() {
  const { fotosSacadas, fotoSacada, rolloLleno } = useBlur()
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [lista, setLista] = useState(false)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [flash, setFlash] = useState(false)
  const [filtroId, setFiltroId] = useState(FILTROS[0].id)
  const filtro = filtroPorId(filtroId)
  const restantes = FOTOS_POR_PERSONA - fotosSacadas
  const terminado = restantes <= 0

  const apagar = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLista(false)
  }, [])

  useEffect(() => apagar, [apagar])

  // Al gastar la última foto la cámara se apaga sola.
  useEffect(() => {
    if (terminado) apagar()
  }, [terminado, apagar])

  const prender = async () => {
    setAviso('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1600 } },
        audio: false,
      })
      if (video.current) video.current.srcObject = stream.current
      setLista(true)
    } catch {
      setAviso('No pudimos abrir la cámara. Revisá el permiso del navegador.')
    }
  }

  const disparar = async () => {
    const v = video.current
    if (!v || terminado || enviando || !v.videoWidth) return
    setAviso('')
    setEnviando(true)
    setFlash(true)
    setTimeout(() => setFlash(false), 120)

    const escala = Math.min(1, LADO_MAX / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * escala)
    c.height = Math.round(v.videoHeight * escala)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    aplicarFiltro(c, filtro, new Date())

    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.82))
    if (blob) {
      try {
        await subirFoto(blob, filtro.id)
        fotoSacada()
      } catch (e) {
        // Si no se pudo enviar, la foto no se gasta: se puede volver a disparar.
        if (e instanceof RolloCompleto) rolloLleno()
        else setAviso('No se pudo enviar la foto. Revisá la conexión y probá de nuevo.')
      }
    }
    setEnviando(false)
  }

  return (
    <>
      <Rotulo>07 · Analógica</Rotulo>
      <Titulo className="mt-3">Analógica</Titulo>
      {!SUBIDA_REAL && <div className="mt-3"><Mock>Las fotos no se suben a ningún lado</Mock></div>}

      <p className="mt-6 text-sm text-apagado">
        Un rollo de {FOTOS_POR_PERSONA} fotos para todo el festival. Elegí la película, apuntá y disparás: no hay vista
        previa ni borrado. Las fotos llegan a la organización, que elige cuáles publicar.
      </p>

      {terminado ? (
        <div className="mt-6 flex aspect-[3/4] flex-col items-center justify-center border border-texto bg-superficie p-8 text-center">
          <p className="rotulo">{FOTOS_POR_PERSONA}/{FOTOS_POR_PERSONA}</p>
          <p className="titulo mt-4 text-5xl">Tu rollo se ha acabado</p>
          <p className="mt-5 text-sm text-apagado">
            Ya no quedan fotos. La organización las revisa y elige cuáles publicar. Gracias por mirar con nosotros.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-6 aspect-[3/4] overflow-hidden border border-texto bg-superficie">
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              style={{ filter: filtro.css }}
              className="h-full w-full object-cover"
            />
            {/* Viñeta y grano del visor: solo una pista, la foto real se procesa al disparar. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${filtro.vineta}) 100%)` }}
            />
            {flash && <div aria-hidden className="absolute inset-0 bg-texto" />}
            {!lista && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <button
                  onClick={prender}
                  className="border border-texto px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] hover:text-acento"
                >
                  Abrir cámara
                </button>
              </div>
            )}
            <span className="absolute right-3 top-3 bg-fondo/80 px-2 py-1 font-mono text-xs">
              {restantes}/{FOTOS_POR_PERSONA}
            </span>
            <span className="absolute left-3 top-3 bg-fondo/80 px-2 py-1 font-mono text-xs uppercase tracking-[0.15em]">
              {filtro.nombre}
            </span>
          </div>

          <div role="radiogroup" aria-label="Película" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={f.id === filtroId}
                onClick={() => setFiltroId(f.id)}
                className={`shrink-0 border px-3 py-2 text-left ${
                  f.id === filtroId ? 'border-acento text-acento' : 'border-linea text-apagado hover:text-texto'
                }`}
              >
                <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.15em]">{f.nombre}</span>
                <span className="block text-[11px]">{f.nota}</span>
              </button>
            ))}
          </div>

          {aviso && <p className="mt-3 text-sm text-acento">{aviso}</p>}

          {lista && (
            <button
              onClick={disparar}
              disabled={enviando}
              aria-label="Sacar foto"
              className="mx-auto mt-5 block h-20 w-20 border-4 border-texto bg-acento disabled:opacity-40"
            />
          )}
        </>
      )}

      <ol className="mt-8 grid grid-cols-10 gap-1" aria-label="Fotos usadas">
        {Array.from({ length: FOTOS_POR_PERSONA }, (_, i) => (
          <li key={i} className={`aspect-square border ${i < fotosSacadas ? 'border-acento bg-acento' : 'border-linea'}`} />
        ))}
      </ol>
    </>
  )
}
