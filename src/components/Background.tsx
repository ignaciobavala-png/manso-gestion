interface BackgroundProps {
  children: React.ReactNode
  className?: string
  backgroundImage?: string
}

export default function Background({ children, className = '', backgroundImage = '/fondo.png' }: BackgroundProps) {
  return (
    <div
      className={`min-h-screen w-full text-gray-200 font-montserrat relative flex flex-col ${className}`}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />
      <div className="relative z-10 flex flex-col flex-grow w-full">
        {children}
      </div>
    </div>
  )
}