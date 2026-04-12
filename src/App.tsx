import { useState } from 'react'
import Main from './pages/Main'
import Home from './pages/Home'
import Entradas from './pages/Entradas'
import Barra from './pages/Barra'
import BottomNav from './components/BottomNav'

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'home' | 'entradas' | 'barra'>('main')

  const renderPage = () => {
    switch (currentPage) {
      case 'main':
        return <Main setCurrentPage={setCurrentPage} />
      case 'home':
        return <Home />
      case 'entradas':
        return <Entradas />
      case 'barra':
        return <Barra />
      default:
        return <Main setCurrentPage={setCurrentPage} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {renderPage()}
      {currentPage !== 'main' && <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />}
    </div>
  )
}

export default App
