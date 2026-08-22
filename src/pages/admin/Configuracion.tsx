import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/compressImage'
import { useVenueConfig, sincronizarVenueConfig } from '../../store/useVenueConfig'

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

  // fondo de la app (venue_config.background_url)
  useEffect(() => { sincronizarVenueConfig() }, [])
  const fondoUrl = useVenueConfig(s => s.fondoUrl)
  const [fondoSubiendo, setFondoSubiendo] = useState(false)
  const [fondoError, setFondoError] = useState('')
  const inputFondo = useRef<HTMLInputElement>(null)

  const guardarFondo = async (url: string | null) => {
    const { data, error } = await supabase
      .from('venue_config')
      .update({ background_url: url })
      .eq('id', 1)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Tu usuario no tiene permiso para cambiar el fondo.')
    }
    await useVenueConfig.getState().cargar()
  }

  const subirFondo = async (file: File) => {
    if (fondoSubiendo) return
    setFondoSubiendo(true)
    setFondoError('')
    try {
      const comprimida = await compressImage(file)

      // Va al bucket que ya existe para imágenes públicas del local. Se
      // sobreescribe siempre el mismo archivo: no tiene sentido acumular
      // fondos viejos que nadie va a volver a elegir.
      const path = 'app/fondo.jpg'
      const { error: storageError } = await supabase.storage
        .from('event-flyers')
        .upload(path, comprimida, { upsert: true, contentType: 'image/jpeg' })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from('event-flyers')
        .getPublicUrl(path)

      // El ?t= rompe la caché: sin eso, subir un fondo nuevo sobre el mismo
      // archivo seguía mostrando el anterior.
      await guardarFondo(`${urlData.publicUrl}?t=${Date.now()}`)
    } catch (err) {
      setFondoError(err instanceof Error ? err.message : 'No se pudo subir el fondo. Intentá de nuevo.')
    } finally {
      setFondoSubiendo(false)
    }
  }

  const restaurarFondo = async () => {
    if (fondoSubiendo) return
    setFondoSubiendo(true)
    setFondoError('')
    try {
      await guardarFondo(null)
    } catch (err) {
      setFondoError(err instanceof Error ? err.message : 'No se pudo restaurar el fondo.')
    } finally {
      setFondoSubiendo(false)
    }
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
        <p className="text-gray-500 text-sm uppercase tracking-widest">Fondo de la app</p>

        <div className="flex gap-4 items-start">
          <div
            className="w-24 h-40 rounded-xl border border-white/15 flex-shrink-0 bg-neutral-900"
            style={{
              backgroundImage: `url(${fondoUrl ?? '/fondo.png'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-gray-400 text-sm leading-relaxed">
              {fondoUrl
                ? 'Fondo propio. Se ve en todas las pantallas, salvo en los eventos que tengan el suyo.'
                : 'La foto que vino con la app. Subí otra cuando quieras renovarla.'}
            </p>
            <button
              onClick={() => inputFondo.current?.click()}
              disabled={fondoSubiendo}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
            >
              {fondoSubiendo ? 'Subiendo...' : fondoUrl ? 'Cambiar la foto' : 'Subir una foto'}
            </button>
            {fondoUrl && (
              <button
                onClick={restaurarFondo}
                disabled={fondoSubiendo}
                className="w-full text-gray-500 hover:text-gray-300 disabled:opacity-60 text-sm underline underline-offset-2 transition-colors"
              >
                Volver a la foto original
              </button>
            )}
          </div>
        </div>

        <input
          ref={inputFondo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={ev => {
            const file = ev.target.files?.[0]
            if (file) subirFondo(file)
            ev.target.value = ''
          }}
        />

        {fondoError && <p className="text-red-400 text-sm">{fondoError}</p>}
        <p className="text-gray-600 text-xs">
          Conviene una foto vertical: se recorta al centro y se le aplica una
          capa oscura para que el texto se lea.
        </p>
      </div>

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
