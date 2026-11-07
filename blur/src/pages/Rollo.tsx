import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { guardarFotos, prepararArchivos, type Guardado } from '../lib/guardar'
import { diasHasta, pedirRollo, type RolloPersonal } from '../lib/revelado'

type Carga = { estado: 'cargando' } | RolloPersonal

/**
 * Las fotos de UN rollo, para guardarlas. Dos entradas a la misma pantalla:
 *   /rollo/<token>  el link que la organización le manda a la persona;
 *   /rollo          el rollo de este teléfono (solo después del festival).
 */
export default function Rollo() {
  const { token } = useParams()
  const [rollo, setRollo] = useState<Carga>({ estado: 'cargando' })
  const [archivos, setArchivos] = useState<File[] | null>(null)
  const [falloBajar, setFalloBajar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState<Guardado | null>(null)

  useEffect(() => {
    let vigente = true
    pedirRollo(token).then((r) => {
      if (!vigente) return
      setRollo(r)
      if (r.estado !== 'ok' || r.fotos.length === 0) return
      // Se bajan ya: `navigator.share` tiene que ejecutarse dentro del toque (ver lib/guardar).
      prepararArchivos(r.fotos, r.numero)
        .then((a) => vigente && setArchivos(a))
        .catch(() => vigente && setFalloBajar(true))
    })
    return () => {
      vigente = false
    }
  }, [token])

  const guardar = async () => {
    if (!archivos || rollo.estado !== 'ok') return
    setGuardando(true)
    setGuardado(await guardarFotos(archivos, rollo.numero))
    setGuardando(false)
  }

  if (rollo.estado === 'cargando') {
    return (
      <Pagina>
        <Rotulo>Tu rollo</Rotulo>
        <Titulo className="mt-5">Revelando</Titulo>
        <p className="pulso mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-apagado">Buscando tus fotos…</p>
      </Pagina>
    )
  }

  if (rollo.estado === 'no-existe') {
    return (
      <Pagina>
        <Rotulo>Tu rollo</Rotulo>
        <Titulo className="mt-5">Sin rollo</Titulo>
        <p className="mt-6 max-w-[30ch] text-sm text-apagado">
          Este link no existe o está mal copiado. Pedile a la organización que te lo mande de nuevo.
        </p>
      </Pagina>
    )
  }

  if (rollo.estado === 'cerrado') {
    const dias = diasHasta(rollo.desde)
    return (
      <Pagina>
        <Rotulo>Tu rollo</Rotulo>
        <Titulo className="mt-5">En el laboratorio</Titulo>
        <p className="mt-6 max-w-[30ch] text-sm text-apagado">
          Tus fotos se revelan después del festival
          {dias ? `: faltan ${dias} ${dias === 1 ? 'día' : 'días'}` : ''}. Vas a poder guardarlas desde acá.
        </p>
        <Link to="/analogica/revelado" className="enlace mt-8">
          Ver el revelado
        </Link>
      </Pagina>
    )
  }

  const { fotos, numero } = rollo
  return (
    <Pagina>
      <Rotulo>{numero ? `Rollo Nº ${numero}` : 'Tu rollo'}</Rotulo>
      <Titulo className="mt-5">Tus fotos</Titulo>

      {fotos.length === 0 ? (
        <p className="mt-6 max-w-[30ch] text-sm text-apagado">Tu rollo todavía no tiene fotos para mostrar.</p>
      ) : (
        <>
          <p className="mt-6 max-w-[30ch] text-sm text-apagado">
            {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'} de tu rollo. Guardalas todas juntas o mantené apretada
            una para guardarla sola.
          </p>

          <div className="entra mt-8 flex flex-wrap items-center gap-4">
            <button className="btn" onClick={() => void guardar()} disabled={!archivos || guardando}>
              {falloBajar ? 'No se pudo preparar' : !archivos ? 'Preparando…' : guardando ? 'Guardando…' : 'Guardar mis fotos'}
            </button>
            {guardado === 'zip' && <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Se bajó un .zip</span>}
          </div>
          {falloBajar && (
            <p className="mt-3 text-sm text-acento">
              No pudimos preparar la descarga. Mantené apretada cada foto para guardarla.
            </p>
          )}

          <ol className="mt-8 grid grid-cols-2 gap-3">
            {fotos.map((f, i) => (
              <li key={f.n} className="entra" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Foto ${f.n}`}>
                  <img
                    src={f.url}
                    alt={`Foto ${f.n} de tu rollo`}
                    loading="lazy"
                    className="aspect-[4/5] w-full bg-[#0b0b0b] object-contain"
                  />
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </Pagina>
  )
}
