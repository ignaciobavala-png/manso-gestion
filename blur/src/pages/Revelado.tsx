import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { filtroPorId } from '../lib/filtros'
import { numeroRollo } from '../lib/fotos'
import { FOTOS_POR_PERSONA } from '../lib/mock'
import { diasHasta, pedirReveladas, type Reveladas } from '../lib/revelado'
import { useBlur } from '../lib/store'

const dos = (n: number) => String(n).padStart(2, '0')

type Carga = { fase: 'cargando' } | { fase: 'cerrado'; desde: string | null } | { fase: 'abierto'; fotos: Extract<Reveladas, { abierto: true }>['fotos'] }

/**
 * Revelado. Hasta que el servidor abre el revelado (después del festival) no hay
 * fotos para ver: queda la espera en el laboratorio, con la hoja de contactos
 * latente del rollo de la persona. Abierto, muestra las fotos que la
 * organización eligió publicar, y el acceso al rollo propio.
 */
export default function Revelado() {
  const { fotosSacadas } = useBlur()
  const [carga, setCarga] = useState<Carga>({ fase: 'cargando' })

  useEffect(() => {
    let vigente = true
    pedirReveladas().then((r) => {
      if (!vigente) return
      setCarga(r.abierto ? { fase: 'abierto', fotos: r.fotos } : { fase: 'cerrado', desde: r.desde })
    })
    return () => {
      vigente = false
    }
  }, [])

  if (carga.fase === 'cargando') {
    return (
      <Pagina>
        <Rotulo>Analógica</Rotulo>
        <Titulo className="mt-5">Revelado</Titulo>
        <p className="pulso mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-apagado">Abriendo el laboratorio…</p>
      </Pagina>
    )
  }

  if (carga.fase === 'abierto') return <Galeria fotos={carga.fotos} tieneRollo={fotosSacadas > 0} />
  return <Espera desde={carga.desde} />
}

/** Después del festival: las fotos publicadas. */
function Galeria({ fotos, tieneRollo }: { fotos: Extract<Carga, { fase: 'abierto' }>['fotos']; tieneRollo: boolean }) {
  return (
    <Pagina>
      <Rotulo>Analógica</Rotulo>
      <Titulo className="mt-5">Revelado</Titulo>
      <p className="mt-6 max-w-[30ch] text-sm text-apagado">
        Las fotos que eligió la organización de los rollos del festival.
      </p>

      {tieneRollo && (
        <Link to="/rollo" className="btn entra mt-8">
          Ver mi rollo
        </Link>
      )}

      {fotos.length === 0 ? (
        <p className="mt-10 text-sm text-apagado">Todavía no hay fotos publicadas. La organización las está eligiendo.</p>
      ) : (
        <ol className="mt-10 grid grid-cols-2 gap-3">
          {fotos.map((f, i) => (
            <li key={f.n} className="entra" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <img
                src={f.url}
                alt={`Foto ${f.n} revelada`}
                loading="lazy"
                className="aspect-[4/5] w-full bg-[#0b0b0b] object-contain"
              />
            </li>
          ))}
        </ol>
      )}
    </Pagina>
  )
}

/** Antes del festival: el rollo en el laboratorio. */
function Espera({ desde }: { desde: string | null }) {
  const { fotosSacadas, pelicula, tira } = useBlur()
  const dias = diasHasta(desde)
  const nombrePelicula = pelicula ? filtroPorId(pelicula).nombre : '—'

  const cuando =
    dias === null ? 'Después del festival' : dias > 0 ? `En ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Ya se está revisando'

  const filas: [string, string][] = [
    ['Rollo Nº', numeroRollo()],
    ['Película', nombrePelicula],
    ['Fotos', `${fotosSacadas} / ${FOTOS_POR_PERSONA}`],
    ['Estado', fotosSacadas === 0 ? 'Sin cargar' : fotosSacadas < FOTOS_POR_PERSONA ? 'En la cámara' : 'En el laboratorio'],
    ['Revelado', cuando],
  ]

  return (
    <Pagina>
      <Rotulo>Analógica</Rotulo>
      <Titulo className="mt-5">Revelado</Titulo>

      <p className="mt-6 max-w-[30ch] text-sm text-apagado">
        Las fotos se revelan después del festival. La organización revisa cada una y publica una selección: no todas
        salen. Cuando estén listas, aparecen acá.
      </p>

      {fotosSacadas === 0 ? (
        <div className="entra mt-10 border-2 border-texto p-6">
          <p className="titulo text-4xl">Todavía no sacaste ninguna foto</p>
          <Link to="/analogica" className="enlace mt-5">
            Ir a la cámara
          </Link>
        </div>
      ) : (
        <div className="entra mt-10 bg-[#111] p-3 text-[#fffcdc]" style={{ boxShadow: '6px 6px 0 rgba(0,0,0,0.25)' }}>
          <p className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[#fffcdc]/70">
            <span>Rollo {numeroRollo()}</span>
            <span>{nombrePelicula}</span>
          </p>
          <ol className="mt-3 grid grid-cols-5 gap-2" aria-label="Hoja de contactos">
            {Array.from({ length: FOTOS_POR_PERSONA }, (_, i) => {
              const expuesto = i < fotosSacadas
              const c = tira[i]?.c ?? ['#3a2012', '#3a2012']
              return (
                <li key={i}>
                  <div className="relative aspect-[3/4] overflow-hidden" style={{ background: expuesto ? '#120a05' : '#1d1d1d' }}>
                    {expuesto && (
                      <div
                        aria-hidden
                        className="revelando absolute"
                        style={{
                          inset: -10,
                          background: `linear-gradient(${c[0]}, ${c[1]})`,
                          animationDelay: `${i * 260}ms`,
                        }}
                      />
                    )}
                  </div>
                  <span className="mt-1 block text-center font-mono text-[10px] text-[#fffcdc]/60">{dos(i + 1)}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <dl className="mt-10 divide-y divide-linea border-y border-linea font-mono text-[11px] uppercase tracking-[0.14em]">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3">
            <dt className="text-apagado">{k}</dt>
            <dd className="text-right font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <Link to="/analogica" className="enlace mt-10">
        Volver a la cámara
      </Link>
    </Pagina>
  )
}
