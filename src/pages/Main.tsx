import Background from '../components/Background'

interface MainProps {
  setCurrentPage: (page: 'main' | 'home' | 'entradas' | 'barra') => void
}

export default function Main({ setCurrentPage }: MainProps): React.JSX.Element {
  const handleNavigation = (pageId: 'home' | 'entradas' | 'barra') => {
    setCurrentPage(pageId)
  }

  return (
    <Background backgroundImage="/fondo.png">
      <main className="flex flex-col flex-grow items-center justify-center px-4">
        <div className="flex justify-center items-center mb-12 gap-4">
          <img 
            src="/logo.png" 
            alt="Logo Manso" 
            className="h-16 w-auto"
          />
          <img 
            src="/manso-name-white.png" 
            alt="Manso Gestión" 
            className="h-12 w-auto"
          />
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => handleNavigation('home')}
            className="w-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white font-medium py-6 px-8 rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Control
          </button>
          
          <button
            onClick={() => handleNavigation('entradas')}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white font-medium py-6 px-8 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900 border border-gray-500"
          >
            Entradas
          </button>
          
          <button
            onClick={() => handleNavigation('barra')}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 px-8 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 focus:ring-offset-gray-900 border border-gray-700"
          >
            Barra
          </button>
        </div>
        
        <p className="text-gray-300 text-sm text-center mt-8 font-light tracking-wide">
          Que empiece el evento
        </p>
      </main>
    </Background>
  )
}