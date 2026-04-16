import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'

export default function EventoActivo() {
  const { activeEvent, refreshData } = useAppStore()

  const [qrUrl, setQrUrl] = useState('')
  const [registrationCount, setRegistrationCount] = useState<number | null>(null)
  const [registrationsOpen, setRegistrationsOpen] = useState(true)
  const [maxCapacity, setMaxCapacity] = useState<string>('')
  const [savingPause, setSavingPause] = useState(false)
  const [savingCapacity, setSavingCapacity] = useState(false)
  const [capacitySaved, setCapacitySaved] = useState(false)
  const capacityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpiar timer de capacidad al desmontar
  useEffect(() => () => { if (capacityTimerRef.current) clearTimeout(capacityTimerRef.current) }, [])

  // Generar QR del evento
  useEffect(() => {
    if (!activeEvent) return
    QRCode.toDataURL(`manso|${activeEvent.id}|${activeEvent.name}`, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then(setQrUrl)
  }, [activeEvent])

  // Cargar estado del evento y conteo de registros
  useEffect(() => {
    if (!activeEvent) return

    supabase
      .from('events')
      .select('registrations_open, max_capacity')
      .eq('id', activeEvent.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setRegistrationsOpen(data.registrations_open)
        setMaxCapacity(data.max_capacity?.toString() ?? '')
      })

    supabase
      .from('ticket_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', activeEvent.id)
      .then(({ count }) => setRegistrationCount(count ?? 0))
  }, [activeEvent])

  if (!activeEvent) return null

  const toggleRegistrations = async () => {
    setSavingPause(true)
    const newValue = !registrationsOpen
    const { error } = await supabase
      .from('events')
      .update({ registrations_open: newValue })
      .eq('id', activeEvent.id)

    if (!error) setRegistrationsOpen(newValue)
    setSavingPause(false)
  }

  const saveCapacity = async () => {
    setSavingCapacity(true)
    setCapacitySaved(false)
    const raw = parseInt(maxCapacity)
    const parsed = maxCapacity.trim() === '' || isNaN(raw) ? null : raw
    const { error } = await supabase
      .from('events')
      .update({ max_capacity: parsed })
      .eq('id', activeEvent.id)

    if (!error) {
      setCapacitySaved(true)
      if (capacityTimerRef.current) clearTimeout(capacityTimerRef.current)
      capacityTimerRef.current = setTimeout(() => setCapacitySaved(false), 2000)
      refreshData()
    }
    setSavingCapacity(false)
  }

  const downloadQR = () => {
    if (!qrUrl) return
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `manso-evento-${activeEvent.name.replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const maxCap = maxCapacity.trim() !== '' && !isNaN(parseInt(maxCapacity)) ? parseInt(maxCapacity) : null
  const isFull = maxCap !== null && registrationCount !== null && registrationCount >= maxCap

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Evento activo</h2>
          <p className="text-emerald-400 text-sm mt-0.5">{activeEvent.name}</p>
        </div>
        {/* Estado del registro */}
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
          registrationsOpen
            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
            : 'bg-amber-900/50 text-amber-400 border border-amber-700'
        }`}>
          {registrationsOpen ? 'Registro abierto' : 'Pausado'}
        </span>
      </div>

      {/* QR del evento */}
      {qrUrl && (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-2xl">
            <img src={qrUrl} alt="QR del evento" className="w-44 h-44" />
          </div>
          <button
            onClick={downloadQR}
            className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Descargar QR del evento
          </button>
        </div>
      )}

      {/* Registros emitidos */}
      <div className="bg-gray-700/50 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">QRs emitidos</p>
          <p className="text-white font-bold text-2xl mt-0.5">
            {registrationCount ?? '—'}
            {maxCap !== null && (
              <span className="text-gray-500 font-normal text-base"> / {maxCap}</span>
            )}
          </p>
        </div>
        {isFull && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-900/50 text-red-400 border border-red-700">
            Lleno
          </span>
        )}
      </div>

      {/* Capacidad máxima */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">
          Capacidad máxima <span className="text-gray-600 normal-case">(dejá vacío para ilimitado)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={maxCapacity}
            onChange={e => { setMaxCapacity(e.target.value); setCapacitySaved(false) }}
            placeholder="Sin límite"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            onClick={saveCapacity}
            disabled={savingCapacity}
            className="px-4 py-2.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {capacitySaved ? '✓' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Toggle pausa */}
      <button
        onClick={toggleRegistrations}
        disabled={savingPause}
        className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 ${
          registrationsOpen
            ? 'bg-amber-700 hover:bg-amber-600 text-white'
            : 'bg-emerald-700 hover:bg-emerald-600 text-white'
        }`}
      >
        {savingPause
          ? 'Guardando...'
          : registrationsOpen
          ? 'Pausar registro de nuevas entradas'
          : 'Reanudar registro de entradas'}
      </button>
    </section>
  )
}
