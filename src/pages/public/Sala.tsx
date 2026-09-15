import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DoorOpen, Lock, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { leerCredencial } from '../../lib/credencialCowork'

/**
 * La pantalla que se abre al escanear el QR pegado en la puerta de una sala:
 * /sala/<token de la sala>.
 *
 * A diferencia del QR de la credencial, este lo escanea el miembro con su
 * propio celular y con la cámara del sistema — por eso el QR lleva una URL y
 * no nuestro formato interno. Quién es lo resuelve la credencial que quedó
 * guardada cuando abrió su carnet.
 *
 * El QR está pegado en una pared, así que cualquiera que pase le puede sacar
 * una foto: a quien llega sin credencial se le dice si la sala está libre u
 * ocupada, pero nunca por quién. Eso lo decide la base, no esta pantalla.
 */

interface Estado {
  sala_nombre: string
  ocupable: boolean
  libre: boolean
  ocupada_por: string | null
  ocupada_hasta: string | null
  minutos_bloque: number
  soy: string | null
  puedo_ocupar: boolean
  motivo: string | null
}

interface Resultado {
  ok: boolean
  motivo: string | null
  sala_nombre: string
  hasta: string | null
  extendida: boolean
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function Sala() {
  const { token } = useParams<{ token: string }>()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupando, setOcupando] = useState(false)
  const [hecho, setHecho] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  const consultar = useCallback(async () => {
    if (!token) return null
    const { data } = await supabase.rpc('cowork_sala_estado', {
      p_sala_token: token,
      p_credencial_token: leerCredencial(),
    })
    return ((data as Estado[] | null) ?? [])[0] ?? null
  }, [token])

  useEffect(() => {
    let cancelado = false
    consultar().then(e => {
      if (cancelado) return
      setEstado(e)
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [consultar])

  const ocupar = async () => {
    const credencial = leerCredencial()
    if (!token || !credencial) return

    setOcupando(true)
    setError('')

    const { data, error: err } = await supabase.rpc('cowork_ocupar_sala', {
      p_sala_token: token,
      p_credencial_token: credencial,
    })

    const r = ((data as Resultado[] | null) ?? [])[0] ?? null

    if (err) setError(err.message)
    else if (r && !r.ok) setError(r.motivo ?? 'No se pudo registrar')
    else if (r) setHecho(r)

    setOcupando(false)
    // Se vuelve a consultar igual: si falló porque otro la ocupó recién, la
    // pantalla tiene que mostrar eso y no el estado con el que se cargó.
    const fresco = await consultar()
    setEstado(fresco)
  }

  if (cargando) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-gray-400 text-sm">Buscando la sala…</p>
        </div>
      </PublicLayout>
    )
  }

  if (!estado) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <h1 className="text-white font-semibold text-lg">Este QR no es de ninguna sala</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-xs leading-relaxed">
            Puede ser un cartel viejo. Avisale a alguien del staff.
          </p>
        </div>
      </PublicLayout>
    )
  }

  const sinCredencial = estado.soy === null

  return (
    <PublicLayout showHeader={false}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-12">
        <div className="w-full max-w-sm">

          <div className="text-center">
            <DoorOpen size={30} className="mx-auto text-terra-400" strokeWidth={1.25} aria-hidden />
            <h1 className="text-white font-bold text-2xl mt-3 tracking-tight">{estado.sala_nombre}</h1>
            {estado.soy && (
              <p className="text-gray-400 text-sm mt-1">Hola {estado.soy}</p>
            )}
          </div>

          {hecho?.ok ? (
            <div className="mt-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-center">
              <Check size={26} className="mx-auto text-emerald-400" aria-hidden />
              <p className="text-white font-semibold mt-2">
                {hecho.extendida ? 'Seguís acá' : 'Listo, quedaste registrado'}
              </p>
              {hecho.hasta && (
                <p className="text-emerald-300 text-sm mt-1">
                  La sala es tuya hasta las {hora(hecho.hasta)}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-3 leading-relaxed">
                Si te quedás más tiempo, volvé a escanear el QR y se extiende.
              </p>
            </div>
          ) : (
            <>
              <div className={`mt-6 rounded-2xl border p-5 text-center ${
                estado.libre
                  ? 'bg-emerald-950/40 border-emerald-500/40'
                  : 'bg-amber-950/40 border-amber-500/40'
              }`}>
                <p className={`font-semibold ${estado.libre ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {!estado.ocupable ? 'Espacio de uso común' : estado.libre ? 'Libre' : 'Ocupada'}
                </p>
                {!estado.libre && estado.ocupada_hasta && (
                  <p className="text-gray-300 text-sm mt-1">
                    {estado.ocupada_por
                      ? <>Está <span className="font-medium">{estado.ocupada_por}</span>, hasta las {hora(estado.ocupada_hasta)}</>
                      : <>Hasta las {hora(estado.ocupada_hasta)}</>}
                  </p>
                )}
              </div>

              {estado.puedo_ocupar ? (
                <button
                  onClick={ocupar}
                  disabled={ocupando}
                  className="w-full mt-4 bg-terra-600 hover:bg-terra-500 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors"
                >
                  {ocupando ? 'Registrando…' : 'Estoy acá'}
                </button>
              ) : (
                <div className="mt-4 bg-neutral-900 border border-white/20 rounded-2xl p-4 flex items-start gap-2.5">
                  <Lock size={15} className="text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
                  <p className="text-gray-300 text-sm leading-relaxed">{estado.motivo}</p>
                </div>
              )}

              {sinCredencial && (
                <p className="text-gray-500 text-xs mt-3 text-center leading-relaxed">
                  Si sos miembro, abrí una vez el link de tu carnet desde este
                  celular y el QR de cualquier sala te va a reconocer solo.
                </p>
              )}

              {estado.puedo_ocupar && (
                <p className="text-gray-500 text-xs mt-3 text-center">
                  Queda tuya por {estado.minutos_bloque} minutos y se libera sola.
                </p>
              )}
            </>
          )}

          {error && (
            <p className="text-red-300 text-sm mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
