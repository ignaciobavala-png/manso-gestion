import { Link } from 'react-router-dom'
import { ConFestival } from '../components/Estado'
import { Rotulo } from '../components/Mock'
import { fechaCorta } from '../lib/festival'
import { SECCIONES } from '../components/Shell'

export default function Inicio() {
  return (
    <ConFestival>
      {({ config, artistas }) => {
        const datos = [fechaCorta(config?.fecha ?? null), config?.horario, config?.lugar].filter(Boolean)
        return (
          <>
            {/* Banner: un toque lleva al lineup. Cuando haya horarios cargados, acá va el DJ que toca ahora. */}
            <Link
              to="/lineup"
              className="relative -mx-4 block aspect-[4/5] overflow-hidden border-y border-linea bg-superficie"
            >
              {config?.banner_url && (
                <img src={config.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-fondo via-fondo/30 to-transparent" />
              <div className="absolute inset-x-4 bottom-5">
                {datos.length > 0 && <Rotulo>{datos.join(' · ')}</Rotulo>}
                <p className="titulo mt-2 text-[clamp(3.5rem,24vw,7rem)]">Blur</p>
                {config?.lema && <p className="mt-2 text-sm">{config.lema}</p>}
                <p className="mt-4 font-mono text-xs uppercase tracking-[0.25em] text-acento">Ver line up →</p>
              </div>
            </Link>

            {config?.vision && (
              <section className="mt-10">
                <Rotulo>Visión</Rotulo>
                <p className="mt-3 whitespace-pre-line text-[17px] leading-[1.45] tracking-[-0.01em]">
                  {config.vision.split('\n\n')[0]}
                </p>
              </section>
            )}

            {artistas.length > 0 && (
              <section className="mt-10">
                <Rotulo>Line up</Rotulo>
                <p className="mt-3 text-xl font-black leading-snug tracking-tight">
                  {artistas.map((a) => a.nombre).join(' · ')}
                </p>
              </section>
            )}

            <section className="mt-10 grid grid-cols-2 gap-px bg-linea">
              {SECCIONES.slice(1).map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="bg-fondo p-4 transition-colors hover:bg-superficie hover:text-acento"
                >
                  <span className="font-mono text-[10px] tracking-[0.2em] text-apagado">{s.n}</span>
                  <span className="titulo mt-6 block text-2xl">{s.nombre}</span>
                </Link>
              ))}
            </section>
          </>
        )
      }}
    </ConFestival>
  )
}
