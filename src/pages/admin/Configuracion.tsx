import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

type Target = 'control' | 'empleado'
type Step = 'idle' | 'form' | 'success' | 'error'

interface Flow {
  target: Target | null
  step: Step
  message: string
}

export default function Configuracion() {
  const { session, usernames, refreshUsernames } = useAuth()

  const [flow, setFlow] = useState<Flow>({ target: null, step: 'idle', message: '' })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // perilla del Cineclub (venue_config.cineclub_activo)
  const [cineclubActivo, setCineclubActivo] = useState<boolean | null>(null)
  const [cineclubSaving, setCineclubSaving] = useState(false)
  const [cineclubError, setCineclubError] = useState('')

  useEffect(() => {
    let cancelado = false
    supabase
      .from('venue_config')
      .select('cineclub_activo')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (!cancelado) setCineclubActivo(data?.cineclub_activo ?? false)
      })
    return () => { cancelado = true }
  }, [])

  const toggleCineclub = async () => {
    if (cineclubActivo === null || cineclubSaving) return
    const nuevo = !cineclubActivo
    setCineclubSaving(true)
    setCineclubError('')
    const { error } = await supabase
      .from('venue_config')
      .update({ cineclub_activo: nuevo })
      .eq('id', 1)
    if (error) {
      setCineclubError('No se pudo guardar. Intentá de nuevo.')
    } else {
      setCineclubActivo(nuevo)
    }
    setCineclubSaving(false)
  }

  // username flow
  const [usernameTarget, setUsernameTarget] = useState<Target | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)

  const resetUsername = () => {
    setUsernameTarget(null)
    setNewUsername('')
    setUsernameError('')
    setUsernameSuccess(false)
  }

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameError('')
    const trimmed = newUsername.trim()
    if (!trimmed || trimmed.length < 3) {
      setUsernameError('El usuario debe tener al menos 3 caracteres')
      return
    }
    if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
      setUsernameError('Solo letras, números, guiones y underscores')
      return
    }

    setUsernameLoading(true)
    const column = usernameTarget === 'control' ? 'control_username' : 'empleado_username'
    const { error } = await supabase
      .from('venue_config')
      .update({ [column]: trimmed.toLowerCase() })
      .eq('id', 1)

    if (error) {
      setUsernameError('Error al guardar. Intentá de nuevo.')
    } else {
      await refreshUsernames()
      setUsernameSuccess(true)
    }
    setUsernameLoading(false)
  }

  const reset = () => {
    setFlow({ target: null, step: 'idle', message: '' })
    setNewPassword('')
    setConfirmPassword('')
    setShowNew(false)
    setShowConfirm(false)
    setFormError('')
  }

  const startFlow = (target: Target) => {
    setFlow({ target, step: 'form', message: '' })
    setNewPassword('')
    setConfirmPassword('')
    setFormError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (newPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setFormError('Las contraseñas no coinciden')
      setConfirmPassword('')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ role: flow.target, newPin: newPassword }),
      })
      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        setFlow(f => ({ ...f, step: 'error', message: 'Error interno del servidor. Contactá a soporte.' }))
        return
      }
      if (res.ok) {
        setFlow(f => ({ ...f, step: 'success' }))
      } else {
        setFlow(f => ({ ...f, step: 'error', message: data.error || 'Error al cambiar la contraseña.' }))
      }
    } catch {
      setFlow(f => ({ ...f, step: 'error', message: 'Sin conexión. Intentá de nuevo.' }))
    } finally {
      setLoading(false)
    }
  }

  if (usernameTarget) {
    if (usernameSuccess) {
      return (
        <div className="flex flex-col items-center text-center py-8 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center text-2xl text-emerald-400 font-bold">✓</div>
          <div>
            <p className="text-white font-semibold">Usuario actualizado</p>
            <p className="text-gray-500 text-sm mt-1">
              {usernameTarget === 'control'
                ? `Desde ahora ingresás con "${usernames.control}".`
                : `Los empleados ingresan con "${usernames.empleados}".`}
            </p>
          </div>
          <button onClick={resetUsername} className="text-gray-500 text-sm underline underline-offset-2">Volver</button>
        </div>
      )
    }

    return (
      <div className="flex flex-col py-2">
        <button onClick={resetUsername} className="self-start text-gray-500 text-sm mb-6">← Volver</button>

        <p className="text-white font-semibold mb-1">
          {usernameTarget === 'control' ? 'Tu usuario (Control)' : 'Usuario de empleados'}
        </p>
        <p className="text-gray-500 text-sm mb-1">
          Actual: <span className="text-white font-mono">{usernameTarget === 'control' ? usernames.control : usernames.empleados}</span>
        </p>
        <p className="text-gray-500 text-sm mb-6">Solo letras, números y guiones. Sin espacios.</p>

        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div>
            <label className="text-white/60 text-xs font-medium mb-1.5 block">Nuevo usuario</label>
            <input
              type="text"
              value={newUsername}
              onChange={e => { setNewUsername(e.target.value); setUsernameError('') }}
              autoComplete="off"
              autoCapitalize="none"
              placeholder="ej: ana / staff"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
            />
          </div>

          {usernameError && <p className="text-red-400 text-sm text-center">{usernameError}</p>}

          <button
            type="submit"
            disabled={usernameLoading || !newUsername.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm"
          >
            {usernameLoading ? 'Guardando...' : 'Guardar usuario'}
          </button>
        </form>
      </div>
    )
  }

  if (flow.step === 'form') {
    return (
      <div className="flex flex-col py-2">
        <button onClick={reset} className="self-start text-gray-500 text-sm mb-6">← Volver</button>

        <p className="text-white font-semibold mb-1">
          {flow.target === 'control' ? 'Tu contraseña' : 'Contraseña de empleados'}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {flow.target === 'control'
            ? 'Usá una contraseña segura. La vas a necesitar para entrar al panel.'
            : 'Todos los empleados usarán esta contraseña para acceder a Barra y Entradas.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/60 text-xs font-medium mb-1.5 block">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setFormError('') }}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 pr-16 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs px-1"
              >
                {showNew ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs font-medium mb-1.5 block">Confirmá la contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFormError('') }}
                autoComplete="new-password"
                placeholder="Repetí la contraseña"
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 pr-16 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs px-1"
              >
                {showConfirm ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 text-sm mt-2"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    )
  }

  if (flow.step === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center text-2xl text-emerald-400 font-bold">✓</div>
        <div>
          <p className="text-white font-semibold">Contraseña actualizada</p>
          <p className="text-gray-500 text-sm mt-1">
            {flow.target === 'control'
              ? 'Usá la nueva contraseña la próxima vez que ingreses.'
              : 'Los empleados ya pueden usar la nueva contraseña.'}
          </p>
        </div>
        <button onClick={reset} className="text-gray-500 text-sm underline underline-offset-2">Volver</button>
      </div>
    )
  }

  if (flow.step === 'error') {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-700 flex items-center justify-center text-2xl text-red-400 font-bold">✕</div>
        <div>
          <p className="text-white font-semibold">No se pudo cambiar</p>
          <p className="text-red-400 text-sm mt-1">{flow.message}</p>
        </div>
        <button onClick={() => startFlow(flow.target!)} className="text-gray-500 text-sm underline underline-offset-2">Intentar de nuevo</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-t border-white/10" />

      <div className="space-y-3">
        <p className="text-gray-500 text-sm uppercase tracking-widest">Usuarios de acceso</p>
        <button
          onClick={() => { setUsernameTarget('control'); setNewUsername(''); setUsernameError(''); setUsernameSuccess(false) }}
          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Tu usuario (Control)</p>
            <p className="text-gray-500 text-sm font-mono">{usernames.control}</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
        <button
          onClick={() => { setUsernameTarget('empleado'); setNewUsername(''); setUsernameError(''); setUsernameSuccess(false) }}
          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Usuario de empleados</p>
            <p className="text-gray-500 text-sm font-mono">{usernames.empleados}</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
      </div>

      <div className="border-t border-white/10" />

      <div className="space-y-3">
        <p className="text-gray-500 text-sm uppercase tracking-widest">Secciones públicas</p>
        <button
          onClick={toggleCineclub}
          disabled={cineclubActivo === null || cineclubSaving}
          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 disabled:opacity-60 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Cineclub</p>
            <p className="text-gray-500 text-sm">
              {cineclubActivo === null
                ? 'Cargando...'
                : cineclubActivo
                  ? 'Visible en la web pública'
                  : 'Oculto — nadie ve la sección'}
            </p>
          </div>
          <span
            className={`w-11 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors ${
              cineclubActivo ? 'bg-emerald-600 justify-end' : 'bg-white/20 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </span>
        </button>
        {cineclubError && <p className="text-red-400 text-sm">{cineclubError}</p>}
        <p className="text-gray-600 text-xs">
          Apagarlo no borra nada: las votaciones y los datos quedan guardados y vuelven al encenderlo.
        </p>
      </div>

      <div className="border-t border-white/10" />

      <div className="space-y-3">
        <p className="text-gray-500 text-sm uppercase tracking-widest">Contraseñas de acceso</p>
        <button
          onClick={() => startFlow('control')}
          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Tu contraseña (Control)</p>
            <p className="text-gray-500 text-sm">Acceso al panel de administración</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
        <button
          onClick={() => startFlow('empleado')}
          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Contraseña de empleados</p>
            <p className="text-gray-500 text-sm">Acceso a Barra y Entradas</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
      </div>
    </div>
  )
}
