import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, DoorOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { leerCredencial } from '../../lib/credencialCowork'

/**
 * El cartel de la entrada: /llegue/<token>.
 *
 * Existe porque una visita, hasta ahora, sólo quedaba registrada ocupando una
 * sala o con alguien del staff escaneando un carnet. El que viene, se sienta
 * en la mesa grande y trabaja seis horas no hacía ninguna de las dos: para el
 * sistema no vino nunca, y sobre esas visitas se calcula todo lo demás.
 *
 * Es el gesto de la sala sin la sala: un toque y listo, sin reservar nada. Por
 * eso tampoco hay nada que mirar antes de tocar — no hay estado que consultar,
 * como sí lo hay en una puerta ("¿está libre?").
 */

interface Resultado {
  ok: boolean
  motivo: string | null
  nombre: string | null
  ya_estaba: boolean
}

export default function Llegada() {
  const { token } = useParams<{ token: string }>()
  const [hecho, setHecho] = useState<Resultado | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [porEmail, setPorEmail] = useState(false)

  const credencial = leerCredencial()

  const registrar = async () => {
    if (!token) return
    setTrabajando(true)
    setError('')

    // Con credencial es directo; sin ella, el mail. La función por mail no
    // devuelve el token —igual que en las salas—: esto es un cartel pegado en
    // una pared y quien lo escanea puede ser cualquiera que pase.
    const { data, error: err } = credencial
      ? await supabase.rpc('cowork_registrar_llegada', {
          p_entrada_token: token,
          p_credencial_token: credencial,
        })
      : await supabase.rpc('cowork_registrar_llegada_por_email', {
          p_entrada_token: token,
          p_email: email.trim(),
        })

    const r = ((data as Resultado[] | null) ?? [])[0] ?? null

    if (err) setError(err.message)
    else if (r && !r.ok) setError(r.motivo ?? 'No se pudo registrar')
    else if (r) { setHecho(r); setPorEmail(!credencial) }

    setTrabajando(false)
  }

  return (
    <PublicLayout showHeader={false}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-12">
        <div className="w-full max-w-sm">

          <div className="text-center">
            <DoorOpen size={30} className="mx-auto text-terra-400" strokeWidth={1.25} aria-hidden />
            <p className="text-gray-400 text-[11px] uppercase tracking-[0.25em] mt-3">
              Manso · Cowork
            </p>
          </div>

          {hecho?.ok ? (
            <div className="mt-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-center">
              <Check size={26} className="mx-auto text-emerald-400" aria-hidden />
              <p className="text-white font-semibold mt-2">
                {hecho.ya_estaba
                  ? `Ya te teníamos, ${hecho.nombre?.split(' ')[0]}`
                  : `Bienvenido, ${hecho.nombre?.split(' ')[0]}`}
              </p>
              <p className="text-gray-300 text-sm mt-1">
                {hecho.ya_estaba
                  ? 'Tu visita de hoy ya estaba registrada.'
                  : 'Listo, quedó registrada tu visita de hoy.'}
              </p>
              <p className="text-gray-400 text-xs mt-3 leading-relaxed">
                Si vas a usar una sala, escaneá el QR de su puerta.
              </p>
              {porEmail && (
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Pedile tu carnet a alguien del staff y abrilo una vez: de ahí
                  en más este celular te reconoce sin escribir nada.
                </p>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-2xl text-center mt-2 tracking-tight">
                ¿Llegaste?
              </h1>

              {!credencial && (
                <div className="mt-5">
                  <p className="text-gray-300 text-sm text-center leading-relaxed">
                    Este celular todavía no te conoce. Poné el mail con el que
                    sos miembro.
                  </p>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    className="w-full mt-3 bg-black/40 border border-white/20 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-gray-500 outline-none focus:border-white/30 transition-all"
                  />
                </div>
              )}

              <button
                onClick={registrar}
                disabled={trabajando || (!credencial && !email.trim())}
                className="w-full mt-4 bg-terra-600 hover:bg-terra-500 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl transition-colors"
              >
                {trabajando ? 'Registrando…' : 'Llegué'}
              </button>

              <p className="text-gray-400 text-xs mt-3 text-center leading-relaxed">
                No reserva nada. Es sólo para que quede tu visita del día.
              </p>
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
