interface BackgroundProps {
  children: React.ReactNode
  className?: string
  backgroundImage?: string
}

export default function Background({ children, className = '', backgroundImage }: BackgroundProps) {
  return (
    <div className={`min-h-screen text-gray-200 font-montserrat relative ${className}`}>
      <div className="absolute inset-0 bg-gray-950 opacity-90 z-0"></div>
      {backgroundImage && (
        <img 
          src={backgroundImage}
          alt="Fondo" 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-30"
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}