import { useFondo } from '../hooks/useSeccionPublica'

interface BackgroundProps {
  children: React.ReactNode
  className?: string
  /**
   * Fondo puntual de esta pantalla (el de un evento, por ejemplo). Pisa al
   * fondo general de la app.
   */
  backgroundImage?: string
}

export default function Background({ children, className = '', backgroundImage }: BackgroundProps) {
  const fondoDeLaApp = useFondo()
  // Una foto solo si alguien la puso: la del evento o la que se cargó en
  // Configuración. Sin eso el fondo es el de la página.
  const foto = backgroundImage ?? fondoDeLaApp ?? null

  return (
    <div className={`min-h-screen w-full bg-manso-black text-gray-200 font-sans relative flex flex-col ${className}`}>
      {/* El fondo de marca está siempre puesto, incluso cuando hay foto: es el
          primer pixel que se pinta y no depende de ninguna consulta. La foto
          de venue_config tarda un viaje a Supabase en llegar; si el negro se
          montara recién ahí, cada recarga arrancaría con un hueco y después
          saltaría al diseño. Así lo que se ve al abrir ya es lo definitivo, y
          la foto —si la hay— aparece encima con un fundido. */}
      <div className="fixed inset-0 z-0 bg-manso-black pointer-events-none" />

      {/* La textura de marca —los rayos— apenas visible y anclada arriba,
          como en manso.club: da profundidad sin ensuciar las tablas ni los
          formularios, que viven en el centro y abajo. */}
      <div
        className="fixed inset-x-0 top-0 h-[70vh] z-0 opacity-[0.07] pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: 'url(/fondo.png)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
        }}
      />

      {/* Un resplandor terra muy tenue arriba: el acento de la marca
          asomando, no un degradado de color sobre toda la pantalla. */}
      <div
        className="fixed inset-x-0 top-0 h-[45vh] z-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(188, 41, 21, 0.28) 0%, rgba(188, 41, 21, 0.06) 45%, transparent 75%)',
        }}
      />

      {foto && (
        <div className="fixed inset-0 z-0 pointer-events-none animate-fade-in">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${foto})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          {/* Un velo parejo y liviano: alcanza para que el texto se lea y
              deja pasar el color de la foto. Estaba en 80% con un degradado
              encima y la foto quedaba casi negra — el número a mover si hay
              que oscurecerla o aclararla es este. */}
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-grow w-full">
        {children}
      </div>
    </div>
  )
}
