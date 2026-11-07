import { useCallback, useEffect, useRef, useState } from 'react'
import { Mock, Pagina, Rotulo, Titulo } from '../components/Mock'
import { ElegirPelicula } from '../components/analogica/Cartucho'
import { Contador } from '../components/analogica/Contador'
import { Rueda } from '../components/analogica/Rueda'
import { Sobre } from '../components/analogica/Sobre'
import { Tira } from '../components/analogica/Tira'
import { FOTOS_POR_PERSONA } from '../lib/mock'
import { FILTROS, aplicarFiltro, colorLatente, filtroPorId, marcoNegativo } from '../lib/filtros'
import { RolloCompleto, SUBIDA_REAL, numeroRollo, subirFoto } from '../lib/fotos'
import { clic, vibrar } from '../lib/sonido'
import { useBlur } from '../lib/store'

/** Lado largo máximo de la foto guardada: alcanza para pantalla y pesa poco. */
const LADO_MAX = 1600
/** El visor es 3:4 vertical y la foto se recorta igual, para que salga lo que se vio. */
const RATIO = 3 / 4
/** Tope del bucket: 3 MB. Con margen. */
const PESO_MAX = 2.8 * 1024 * 1024

/** Deja pintar el frame actual (flash, contador) antes de un trabajo pesado en el hilo principal. */
const pintar = () => new Promise<void>((ok) => requestAnimationFrame(() => setTimeout(ok, 0)))

async function aJpeg(c: HTMLCanvasElement): Promise<Blob | null> {
  // El grano pesa mucho: si se pasa del tope del bucket, se baja la calidad.
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', q))
    if (!blob || blob.size <= PESO_MAX) return blob
  }
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.45))
}

export default function Analogica() {
  const { fotosSacadas, pelicula } = useBlur()
  if (fotosSacadas >= FOTOS_POR_PERSONA) return <Entrega />
  // Rollos empezados antes de que existiera la elección de película siguen su curso.
  if (pelicula === null && fotosSacadas === 0) return <Cargar />
  return <Camara />
}

function AvisoMock() {
  return SUBIDA_REAL ? null : (
    <div className="mt-3">
      <Mock>Las fotos no se suben a ningún lado</Mock>
    </div>
  )
}

/** 1 · Elegir la película y cargar el rollo. */
function Cargar() {
  const cargarPelicula = useBlur((s) => s.cargarPelicula)
  return (
    <Pagina>
      <Rotulo>Rollo</Rotulo>
      <Titulo className="mt-5">Analógica</Titulo>
      <AvisoMock />
      <p className="mt-6 max-w-[28ch] text-sm text-apagado">
        {FOTOS_POR_PERSONA} fotos para todo el festival. Sin vista previa, sin borrar. Una película, y un solo cambio.
      </p>
      <div className="mt-1">
        <ElegirPelicula inicial={FILTROS[0].id} boton="Cargar rollo" onConfirmar={cargarPelicula} />
      </div>
    </Pagina>
  )
}

/** 2 · La cámara. */
function Camara() {
  const { fotosSacadas, fotoSacada, rolloLleno, pelicula, cambiarPelicula, cambioUsado, tira } = useBlur()
  const filtro = filtroPorId(pelicula ?? FILTROS[0].id)
  const restantes = FOTOS_POR_PERSONA - fotosSacadas

  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [lista, setLista] = useState(false)
  const [frente, setFrente] = useState(false)
  const [armado, setArmado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [flash, setFlash] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const apagar = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLista(false)
  }, [])

  // Al salir de la pantalla (o al gastar la última foto) la cámara se apaga sola.
  useEffect(() => apagar, [apagar])

  const prender = async (deFrente = frente) => {
    setAviso('')
    apagar()
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: deFrente ? 'user' : 'environment', width: { ideal: 1600 } },
        audio: false,
      })
      if (video.current) video.current.srcObject = stream.current
      setLista(true)
    } catch {
      setAviso('No pudimos abrir el visor. Revisá el permiso de la cámara en el navegador.')
    }
  }

  const girar = () => {
    const nuevo = !frente
    setFrente(nuevo)
    if (lista) void prender(nuevo)
  }

  const disparar = async () => {
    const v = video.current
    if (!v || !armado || enviando || !v.videoWidth) return
    setAviso('')
    setEnviando(true)
    setArmado(false)
    clic()
    vibrar(25)
    setFlash(true)
    setTimeout(() => setFlash(false), 140)
    await pintar()

    // Recorte 3:4 centrado: lo mismo que mostraba el visor.
    const vw = v.videoWidth
    const vh = v.videoHeight
    let sw = vw
    let sh = vh
    let sx = 0
    let sy = 0
    if (vw / vh > RATIO) {
      sw = vh * RATIO
      sx = (vw - sw) / 2
    } else {
      sh = vw / RATIO
      sy = (vh - sh) / 2
    }
    const escala = Math.min(1, LADO_MAX / Math.max(sw, sh))
    const c = document.createElement('canvas')
    c.width = Math.round(sw * escala)
    c.height = Math.round(sh * escala)
    c.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
    aplicarFiltro(c, filtro, new Date())
    const latente = colorLatente(c)
    const blob = await aJpeg(marcoNegativo(c, filtro, fotosSacadas + 1))

    if (blob) {
      try {
        await subirFoto(blob, filtro.id)
        fotoSacada({ f: filtro.id, c: latente })
      } catch (e) {
        // Si no se pudo enviar, la foto no se gasta: queda armada para volver a disparar.
        if (e instanceof RolloCompleto) rolloLleno()
        else {
          setArmado(true)
          setAviso('No se pudo enviar la foto. Revisá la conexión y probá de nuevo.')
        }
      }
    } else {
      setArmado(true)
      setAviso('No se pudo procesar la foto. Probá de nuevo.')
    }
    setEnviando(false)
  }

  const pista = !lista
    ? 'Abrí el visor para empezar'
    : enviando
      ? 'Guardando…'
      : armado
        ? 'Lista. Apuntá y disparás, sin ver el resultado'
        : 'Arrastrá la rueda para armar la próxima foto'

  return (
    <Pagina className="pt-5">
      <div
        className="entra bg-[#f65200] p-5 text-[#003009]"
        style={{ borderRadius: 28, boxShadow: '0 10px 0 rgba(0,0,0,0.4)' }}
      >
        <div className="entra flex items-end justify-between" style={{ animationDelay: '120ms' }}>
          <Contador valor={restantes} tam={34} />
          <p className="pb-1 font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Analógica</p>
        </div>

        {/* El ancho sale del alto disponible para que la cámara entre sin scroll. */}
        <div
          className="entra mx-auto mt-5"
          style={{ width: 'min(100%, calc(52svh * 0.75))', animationDelay: '200ms' }}
        >
          <div
            className={`relative aspect-[3/4] overflow-hidden bg-[#0b0b0b] ${flash ? 'obturar' : ''}`}
            style={{ border: '3px solid #003009', borderRadius: 6 }}
          >
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              style={{ filter: filtro.css, transform: frente ? 'scaleX(-1)' : undefined }}
              className={`h-full w-full object-cover ${lista ? 'iris' : 'opacity-0'}`}
            />
            {/* Viñeta del visor: solo una pista, la foto real se procesa al disparar. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${filtro.vineta}) 100%)` }}
            />
            {/* Marcas de encuadre en las cuatro esquinas. */}
            {['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map(
              (c) => (
                <span key={c} aria-hidden className={`pointer-events-none absolute h-5 w-5 border-[#fffcdc] ${c}`} />
              ),
            )}
            {flash && <div aria-hidden className="absolute inset-0 bg-[#fffcdc]" />}
            {!lista && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <button onClick={() => void prender()} className="btn">
                  Abrir visor
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="entra mt-5" style={{ animationDelay: '280ms' }}>
          <Rueda armado={armado} bloqueada={!lista || enviando} onArmar={() => setArmado(true)} />
        </div>

        <div className="entra mt-6 grid grid-cols-3 items-center" style={{ animationDelay: '360ms' }}>
          <button
            onClick={() => setCambiando(true)}
            disabled={cambioUsado}
            className="justify-self-start py-3 text-left font-mono text-[11px] font-bold uppercase leading-snug tracking-[0.12em] disabled:opacity-60"
          >
            {filtro.nombre}
            <span className="block font-normal">{cambioUsado ? 'película fija' : 'cambiar · 1'}</span>
          </button>
          <div className="relative h-[84px] w-[84px] justify-self-center">
            {armado && !enviando && <span aria-hidden className="anillo absolute inset-0 rounded-full" />}
            <button
              onClick={() => void disparar()}
              disabled={!armado || !lista || enviando}
              aria-label="Sacar foto"
              className="relative h-full w-full rounded-full border-[5px] border-[#fffcdc] bg-[#111] transition-[transform,opacity] duration-150 active:scale-95 disabled:opacity-40"
              style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.45)' }}
            />
          </div>
          <button
            onClick={girar}
            className="justify-self-end py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
          >
            Girar
          </button>
        </div>
      </div>

      <p
        key={pista}
        role="status"
        className="entra mt-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-apagado"
      >
        {pista}
      </p>
      {aviso && <p className="mt-3 text-center text-sm text-acento">{aviso}</p>}

      <div className="entra mt-10" style={{ animationDelay: '440ms' }}>
        <Tira frames={tira} sacadas={fotosSacadas} />
      </div>
      <div className="mt-6 text-center">
        <AvisoMock />
      </div>

      {cambiando && (
        <div className="tema-verde fixed inset-0 z-50 overflow-y-auto">
          <Pagina>
            <Rotulo>Cambiar película</Rotulo>
            <p className="mt-4 text-sm text-apagado">
              Es el único cambio del rollo. Las {fotosSacadas} fotos que ya sacaste quedan como están.
            </p>
            <div className="mt-2">
              <ElegirPelicula
                inicial={filtro.id}
                boton="Cargar esta"
                onConfirmar={(id) => {
                  if (id !== filtro.id) cambiarPelicula(id)
                  setCambiando(false)
                }}
                onCancelar={() => setCambiando(false)}
              />
            </div>
          </Pagina>
        </div>
      )}
    </Pagina>
  )
}

/** 3 · Rollo completo: sobre de entrega. */
function Entrega() {
  const { fotosSacadas, tira } = useBlur()
  return (
    <Pagina>
      <Rotulo>Rollo completo</Rotulo>
      <Titulo className="mt-5">Entregado</Titulo>
      <AvisoMock />
      <Sobre numero={numeroRollo()} />
      <p className="mt-10 text-sm text-apagado">
        Se acabó el rollo. Las {FOTOS_POR_PERSONA} fotos ya están con la organización, que las revisa y elige cuáles
        publicar. Gracias por mirar con nosotros.
      </p>
      <div className="mt-6">
        <Tira frames={tira} sacadas={Math.min(fotosSacadas, FOTOS_POR_PERSONA)} />
      </div>
    </Pagina>
  )
}
