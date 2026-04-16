import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

type PinStep = 'idle' | 'enter_new' | 'confirm_1' | 'confirm_2' | 'success' | 'error'

interface PinFlow {
  target: 'control' | 'empleado' | null
  step: PinStep
  newPin: string
  message: string
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

const STEP_LABELS: Record<PinStep, string> = {
  idle: '',
  enter_new: 'Nuevo PIN',
  confirm_1: 'Confirmá el PIN',
  confirm_2: 'Confirmá una vez más',
  success: '',
  error: '',
}

export default function Configuracion() {
  const { session } = useAuth()

  // ── PIN flow ─────────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<PinFlow>({ target: null, step: 'idle', newPin: '', message: '' })
  const [pin, setPin] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  // ── Datos de pago ─────────────────────────────────────────────────────────
  const [alias, setAlias] = useState('')
  const [cbu, setCbu] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    supabase
      .from('venue_config')
      .select('alias_pago, cbu_pago')
      .single()
      .then(({ data }) => {
        if (data) {
          setAlias(data.alias_pago ?? '')
          setCbu(data.cbu_pago ?? '')
        }
      })
  }, [])

  const savePaymentData = async () => {
    setPaymentLoading(true)
    setPaymentStatus('idle')
    const { error } = await supabase
      .from('venue_config')
      .update({ alias_pago: alias.trim() || null, cbu_pago: cbu.trim() || null })
      .eq('id', 1)
    setPaymentLoading(false)
    setPaymentStatus(error ? 'error' : 'saved')
  }

  // ── PIN handlers ──────────────────────────────────────────────────────────
  const resetPin = () => {
    setFlow({ target: null, step: 'idle', newPin: '', message: '' })
    setPin('')
  }

  const startFlow = (target: 'control' | 'empleado') => {
    setFlow({ target, step: 'enter_new', newPin: '', message: '' })
    setPin('')
  }

  const handleKey = async (key: string) => {
    if (pinLoading || key === '') return

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }

    if (pin.length >= 4) return

    const current = pin + key
    setPin(current)
    if (current.length < 4) return

    if (flow.step === 'enter_new') {
      setFlow(f => ({ ...f, step: 'confirm_1', newPin: current, message: '' }))
      setPin('')
      return
    }

    if (flow.step === 'confirm_1') {
      if (current !== flow.newPin) {
        setFlow(f => ({ ...f, step: 'enter_new', newPin: '', message: 'No coincidió. Ingresá el nuevo PIN de vuelta.' }))
        setPin('')
        return
      }
      setFlow(f => ({ ...f, step: 'confirm_2', message: '' }))
      setPin('')
      return
    }

    if (flow.step === 'confirm_2') {
      if (current !== flow.newPin) {
        setFlow(f => ({ ...f, step: 'enter_new', newPin: '', message: 'No coincidió. Empezá de nuevo.' }))
        setPin('')
        return
      }

      setPinLoading(true)
      setPin('')
      try {
        const res = await fetch('/api/change-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ role: flow.target, newPin: flow.newPin }),
        })
        const data = await res.json()
        setFlow(f => ({ ...f, step: res.ok ? 'success' : 'error', message: res.ok ? '' : (data.error || 'Error al cambiar el PIN.') }))
      } catch {
        setFlow(f => ({ ...f, step: 'error', message: 'Sin conexión. Intentá de nuevo.' }))
      } finally {
        setPinLoading(false)
      }
    }
  }

  // ── PANTALLA: teclado PIN ─────────────────────────────────────────────────
  if (flow.step !== 'idle' && flow.step !== 'success' && flow.step !== 'error') {
    const progressStep = flow.step === 'enter_new' ? 1 : flow.step === 'confirm_1' ? 2 : 3
    return (
      <div className="flex flex-col items-center py-2">
        <button onClick={resetPin} className="self-start text-gray-500 text-sm mb-6">← Volver</button>

        <div className="flex items-center gap-2 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 w-8 rounded-full transition-colors ${s <= progressStep ? 'bg-emerald-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{STEP_LABELS[flow.step]}</p>
        {flow.message && <p className="text-red-400 text-xs mt-2 mb-1 text-center">{flow.message}</p>}

        <div className="flex gap-5 my-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${pin.length > i ? 'bg-emerald-400 border-emerald-400 scale-110' : 'bg-transparent border-gray-600'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 w-64">
          {KEYS.map((key, i) => {
            if (key === '') return <div key={i} />
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={pinLoading}
                className={`h-14 rounded-2xl text-xl font-medium transition-all duration-100 active:scale-95 bg-gray-700 active:bg-gray-600 ${key === '⌫' ? 'text-gray-400' : 'text-white'} ${pinLoading ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (flow.step === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center text-2xl text-emerald-400 font-bold">✓</div>
        <div>
          <p className="text-white font-semibold">PIN actualizado</p>
          <p className="text-gray-500 text-sm mt-1">
            {flow.target === 'control' ? 'Usá el nuevo PIN la próxima vez que ingreses.' : 'Los empleados ya pueden usar el nuevo PIN.'}
          </p>
        </div>
        <button onClick={resetPin} className="text-gray-500 text-sm underline underline-offset-2">Volver</button>
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

  // ── PANTALLA: idle (menú principal de config) ─────────────────────────────
  return (
    <div className="space-y-6">

      {/* Datos de pago para /carta */}
      <div className="space-y-3">
        <p className="text-gray-500 text-xs uppercase tracking-widest">Datos de pago — carta digital</p>
        <p className="text-gray-600 text-xs leading-relaxed">
          Estos datos aparecen en <span className="text-gray-400">/carta</span> cuando un cliente confirma su pedido. Le sirven para hacer la transferencia antes de pasar a buscar su pedido a la barra.
        </p>

        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Alias</label>
            <input
              type="text"
              value={alias}
              onChange={e => { setAlias(e.target.value); setPaymentStatus('idle') }}
              placeholder="ej: manso.club"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CBU / CVU <span className="text-gray-600">(opcional)</span></label>
            <input
              type="text"
              value={cbu}
              onChange={e => { setCbu(e.target.value); setPaymentStatus('idle') }}
              placeholder="22 dígitos"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <button
          onClick={savePaymentData}
          disabled={paymentLoading}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors active:scale-95"
        >
          {paymentLoading ? 'Guardando...' : 'Guardar datos de pago'}
        </button>

        {paymentStatus === 'saved' && (
          <p className="text-emerald-400 text-xs text-center">Guardado. Ya se ve en /carta.</p>
        )}
        {paymentStatus === 'error' && (
          <p className="text-red-400 text-xs text-center">Error al guardar. Intentá de nuevo.</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* PINs */}
      <div className="space-y-3">
        <p className="text-gray-500 text-xs uppercase tracking-widest">PINs de acceso</p>
        <button
          onClick={() => startFlow('control')}
          className="w-full flex items-center justify-between bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">Tu PIN (Control)</p>
            <p className="text-gray-500 text-xs">Acceso al panel de administración</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
        <button
          onClick={() => startFlow('empleado')}
          className="w-full flex items-center justify-between bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-3.5 transition-colors"
        >
          <div className="text-left">
            <p className="text-white text-sm font-medium">PIN de empleados</p>
            <p className="text-gray-500 text-xs">Acceso a Barra y Entradas</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
      </div>

    </div>
  )
}
