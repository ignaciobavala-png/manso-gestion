interface BackgroundProps {
  children: React.ReactNode
  className?: string
}

export default function Background({ children, className = '' }: BackgroundProps) {
  return (
    <div className={`min-h-screen text-gray-200 font-montserrat relative ${className}`}>
      <div className="absolute inset-0 bg-gray-950 opacity-90 z-0"></div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}