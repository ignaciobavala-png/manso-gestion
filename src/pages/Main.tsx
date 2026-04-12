interface MainProps {
  setCurrentPage: (page: 'main' | 'home' | 'entradas' | 'barra') => void
}

export default function Main({ setCurrentPage }: MainProps) {
  const handleNavigation = (pageId: 'home' | 'entradas' | 'barra') => {
    setCurrentPage(pageId)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-montserrat flex flex-col items-center justify-center">
      <main className="w-full max-w-md px-4">
        <div className="flex justify-center mb-12">
          <img 
            src="/manso-name-white.png" 
            alt="Manso Gestión" 
            className="h-12 w-auto"
          />
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => handleNavigation('home')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-6 px-8 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 border border-gray-600"
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
        
        <p className="text-gray-600 text-sm text-center mt-8 font-light">
          Seleccionar módulo
        </p>
      </main>
    </div>
  )
}