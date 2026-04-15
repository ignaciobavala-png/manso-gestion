import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleKey = async (key: string) => {
    if (loading || key === '') return

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      setError('')
      return
    }

    if (pin.length >= 4) return

    const newPin = pin + key
    setPin(newPin)
    setError('')

    if (newPin.length === 4) {
      setLoading(true)
      const role = await signIn(newPin)
      if (role === 'control') {
        navigate('/admin/home')
      } else if (role === 'empleado') {
        navigate('/admin/barra')
      } else {
        setError('PIN incorrecto')
        setPin('')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 select-none">
      {/* Logo */}
      <div className="mb-12 flex flex-col items-center gap-3">
        <img src="/logo.png" alt="Manso" className="h-20 w-auto object-contain" />
        <img src="/manso-name-white.png" alt="MANSO" className="h-7 w-auto object-contain opacity-90" />
      </div>

      {/* Puntos del PIN */}
      <div className="flex gap-5 mb-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
              pin.length > i
                ? 'bg-emerald-400 border-emerald-400 scale-110'
                : 'bg-transparent border-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      <div className="h-7 mb-4 flex items-center justify-center">
        {error && (
          <p className="text-red-400 text-sm tracking-wide">{error}</p>
        )}
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {KEYS.map((key, i) => {
          if (key === '') {
            return <div key={i} />
          }
          return (
            <button
              key={i}
              onClick={() => handleKey(key)}
              disabled={loading}
              className={`
                h-16 rounded-2xl text-xl font-medium
                transition-all duration-100 active:scale-95
                ${key === '⌫'
                  ? 'bg-gray-800 text-gray-400 active:bg-gray-700'
                  : 'bg-gray-800 text-white active:bg-gray-700'
                }
                ${loading ? 'opacity-40 pointer-events-none' : ''}
              `}
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
