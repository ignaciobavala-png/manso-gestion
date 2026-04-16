import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Background from '../components/Background'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

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
        triggerShake()
      }
    }
  }

  return (
    <Background backgroundImage="/fondo.png">
      <div className="min-h-screen flex flex-col items-center justify-center px-4 select-none">

        {/* Logo */}
        <div className="mb-14 flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Manso" className="h-20 w-auto object-contain drop-shadow-lg" />
          <img src="/manso-name-white.png" alt="MANSO" className="h-7 w-auto object-contain opacity-90" />
        </div>

        {/* Card */}
        <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl px-8 pt-8 pb-9 flex flex-col items-center gap-6 w-80 shadow-2xl">

          {/* Subtítulo */}
          <p className="text-gray-400 text-sm tracking-widest uppercase font-medium">Ingresá tu PIN</p>

          {/* Puntos */}
          <div className={`flex gap-5 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                  pin.length > i
                    ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-transparent border-white/30'
                }`}
              />
            ))}
          </div>

          {/* Error */}
          <div className="h-4 flex items-center justify-center -mt-2">
            {error && (
              <p className="text-red-400 text-xs tracking-wide">{error}</p>
            )}
          </div>

          {/* Teclado */}
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {KEYS.map((key, i) => {
              if (key === '') return <div key={i} />
              const isBackspace = key === '⌫'
              return (
                <button
                  key={i}
                  onClick={() => handleKey(key)}
                  disabled={loading}
                  className={`
                    h-14 rounded-2xl text-xl font-medium
                    transition-all duration-100 active:scale-90
                    border backdrop-blur-sm
                    ${isBackspace
                      ? 'bg-white/5 border-white/10 text-gray-500 active:bg-white/10'
                      : 'bg-white/10 border-white/15 text-white active:bg-white/20 active:border-white/25'
                    }
                    ${loading ? 'opacity-30 pointer-events-none' : ''}
                  `}
                >
                  {loading && key !== '⌫' && pin.length === 0
                    ? null
                    : key}
                </button>
              )
            })}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </Background>
  )
}
