import { Link } from 'react-router-dom'
import { ConFestival } from '../components/Estado'
import { Rotulo } from '../components/Mock'
import { Nombres } from '../components/Nombres'
import { MARCA, SECCIONES } from '../components/Shell'
import { fechaCorta, lineupPorEscenario } from '../lib/festival'

/** Atajos de la app: lo que se usa durante el festival. El line up tiene su propio bloque abajo. */
const ATAJOS = SECCIONES.filter((s) => !['/', '/lineup'].includes(s.to))

export default function Inicio() {
  return (
    <ConFestival>
      {(f) => {
        const { config } = f
        const cuando = [fechaCorta(config?.fecha ?? null), config?.horario].filter(Boolean).join(' — ')
        const grupos = lineupPorEscenario(f)
        const vision = (config?.vision ?? '').split('\n\n').filter(Boolean)

        return (
          <>
            {/* HERO: paisaje a pantalla completa, marca al centro, datos abajo a la izquierda. */}
            <section className="tema-verde relative flex min-h-[calc(100svh-6.5rem)] flex-col justify-between overflow-hidden">
              {config?.banner_url && (
                <img src={config.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-[#003009]/20 via-transparent to-[#003009]"
              />

              <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
                <img src={`${MARCA}logo_1_b.svg`} alt="BLUR" className="w-[min(72vw,19rem)]" />
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.35em]">Hecho en Argentina</p>
                <div className="mt-8 flex gap-3">
                  <Link to="/lineup" className="btn">Line up</Link>
                  <Link to="/barra" className="btn-borde">Barra</Link>
                </div>
              </div>

              <div className="relative px-4 pb-5">
                <p className="text-[15px] font-bold tracking-tight">manso club</p>
                {cuando && <p className="mt-1.5 font-mono text-[12px] uppercase">{cuando}</p>}
                {config?.lugar && <p className="font-mono text-[12px] uppercase">{config.lugar}</p>}
              </div>
            </section>

            {/* EN EL FESTIVAL: los atajos de la app, con el peso de los nombres del line up. */}
            <section className="tema-gris textura textura-color px-4 pb-10 pt-12">
              <Rotulo>En el festival</Rotulo>
              <ul className="mt-6">
                {ATAJOS.map((s) => (
                  <li key={s.to} className="border-t border-linea first:border-t-0">
                    <Link to={s.to} className="flex items-center justify-between gap-4 py-4">
                      <span>
                        <span className="nombre block">{s.nombre}</span>
                        <span className="mt-1 block font-mono text-[12px] uppercase text-apagado">{s.desc}</span>
                      </span>
                      <span aria-hidden className="chevron text-acento text-xl" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {vision.length > 0 && (
              <section className="tema-naranja px-4 pb-0 pt-12">
                <Rotulo>Visión</Rotulo>
                <div className="mt-6 space-y-4 text-[17px] leading-[1.35]">
                  {vision.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <img
                  src={`${MARCA}ilus-bailando.webp`}
                  alt=""
                  loading="lazy"
                  className="mx-auto mt-8 block w-full max-w-sm"
                />
              </section>
            )}

            {grupos.length > 0 && (
              <section className="tema-verde textura textura-clara px-4 pb-12 pt-12">
                <Rotulo>Line up</Rotulo>
                <div className="mt-8 space-y-10">
                  {grupos.map((e) => (
                    <div key={e.id}>
                      <Rotulo>{e.nombre}</Rotulo>
                      <div className="mt-4">
                        <Nombres artistas={e.artistas} />
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/lineup" className="enlace mt-10">Ver line up</Link>
              </section>
            )}

            <footer className="tema-verde border-t border-linea px-4 py-5">
              <img src={`${MARCA}logo_1_b.svg`} alt="BLUR" className="h-4 w-auto" />
              <p className="mt-3 text-sm font-bold tracking-tight text-apagado">manso club</p>
            </footer>
          </>
        )
      }}
    </ConFestival>
  )
}
