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

/** La que viene con la app. Se usa mientras no haya otra cargada. */
const FONDO_POR_DEFECTO = '/fondo.png'

export default function Background({ children, className = '', backgroundImage }: BackgroundProps) {
  const fondoDeLaApp = useFondo()
  const fondo = backgroundImage ?? fondoDeLaApp ?? FONDO_POR_DEFECTO

  return (
    <div className={`min-h-screen w-full text-gray-200 font-montserrat relative flex flex-col ${className}`}>
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${fondo})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />
      <div className="relative z-10 flex flex-col flex-grow w-full">
        {children}
      </div>
    </div>
  )
}
