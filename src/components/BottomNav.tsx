interface BottomNavProps {
  currentPage: 'main' | 'home' | 'entradas' | 'barra'
  setCurrentPage: (page: 'main' | 'home' | 'entradas' | 'barra') => void
}

export default function BottomNav({ currentPage, setCurrentPage }: BottomNavProps) {
  const navItems = [
    { id: 'main', label: 'Principal', icon: '🏠' },
    { id: 'home', label: 'Control', icon: '📊' },
    { id: 'entradas', label: 'Entradas', icon: '🎫' },
    { id: 'barra', label: 'Barra', icon: '🍺' },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-gray-800 border-t border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <ul className="flex justify-around">
          {navItems.map((item) => (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => setCurrentPage(item.id as 'main' | 'home' | 'entradas' | 'barra')}
                className={`
                  w-full flex flex-col items-center
                  min-h-14 min-w-14 px-3 py-2
                  text-xs font-medium
                  transition-colors
                  ${currentPage === item.id 
                    ? 'text-emerald-400' 
                    : 'text-gray-400 hover:text-gray-300'
                  }
                `}
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}