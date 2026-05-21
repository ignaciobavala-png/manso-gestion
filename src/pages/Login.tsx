import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Background from '../components/Background'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    setError('')

    const role = await signIn(username.trim(), password)

    if (role === 'control') {
      navigate('/admin/home')
    } else if (role === 'empleado') {
      navigate('/admin/barra')
    } else {
      setError('Usuario o contraseña incorrectos')
      setPassword('')
      setLoading(false)
    }
  }

  return (
    <Background backgroundImage="/fondo.png">
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="w-full mb-4">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
              aria-label="Volver al inicio"
            >
              ←
            </button>
          </div>

          <div className="mb-8 flex flex-col items-center gap-3">
            <img src="/logo.png" alt="Manso" className="h-20 w-auto object-contain drop-shadow-lg" />
            <img src="/manso-name-white.png" alt="MANSO" className="h-7 w-auto object-contain opacity-90" />
          </div>

          <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl px-8 pt-8 pb-9 w-80 mx-auto shadow-2xl">
            <p className="text-gray-400 text-sm tracking-widest uppercase font-medium text-center mb-6">
              Acceso interno
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-white/60 text-xs font-medium mb-1.5 block">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="control / empleados"
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs font-medium mb-1.5 block">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs px-1"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm mt-2"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Background>
  )
}
