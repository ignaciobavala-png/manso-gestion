import Background from './Background'

interface PublicLayoutProps {
  children: React.ReactNode
  /** Si true, muestra el header con logo grande (para páginas de bienvenida) */
  showHeader?: boolean
}

export default function PublicLayout({ children, showHeader = true }: PublicLayoutProps) {
  return (
    <Background>
      <div className="flex flex-col flex-1 w-full min-h-screen">
        {showHeader && (
          <header className="flex flex-col items-center pt-12 pb-6 px-6">
            <img
              src="/logo.png"
              alt="Manso"
              className="h-16 w-auto object-contain mb-3"
            />
            <img
              src="/manso-name-white.png"
              alt="MANSO"
              className="h-6 w-auto object-contain opacity-90"
            />
          </header>
        )}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </Background>
  )
}
