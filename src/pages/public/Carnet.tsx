import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ticket } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import CarnetMiembro, { type Carnet } from '../../components/CarnetMiembro'
import { guardarCredencial } from '../../lib/credencialCowork'

/**
 * El carnet del coworker: /c/<token de su credencial>.
 *
 * Es el link que se le entrega una vez a cada miembro. Hace dos cosas: le
 * muestra su estado —plan, hasta cuándo, en qué sala está— y, de paso, deja
 * su credencial guardada en este navegador. Eso último es lo que después
 * permite que el QR pegado en la puerta de una sala sepa quién la escanea.
 *
 * No pide login: se entra sabiendo el token, igual que /mi-entrada con el de
 * una entrada. Todo lo que se ve sale de un RPC que devuelve nada más que lo
 * que va en pantalla — ni teléfono, ni notas, ni cuánto pagó.
 *
 * También guarda su mail, que es lo que le permite a /mi-entrada mostrarle
 * sus entradas sin volver a preguntárselo: son la misma persona y no tendría
 * por qué identificarse dos veces.
 */

export default function CarnetCowork() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [carnet, setCarnet] = useState<Carnet | null>(null)
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async () => {
    if (!token) return null
    const { data } = await supabase.rpc('cowork_carnet', { p_token: token })
    return ((data as Carnet[] | null) ?? [])[0] ?? null
  }, [token])

  useEffect(() => {
    let cancelado = false

    consultar().then(c => {
      if (cancelado) return
      setCarnet(c)
      setCargando(false)
      // Solo se guarda si el token sirvió: un link viejo o revocado no puede
      // dejar una credencial muerta pegada en el celular de alguien.
      if (c && token) {
        guardarCredencial(token)
        if (c.email) {
          try { localStorage.setItem('manso_email', c.email) } catch { /* storage bloqueado */ }
        }
      }
    })

    return () => { cancelado = true }
  }, [consultar, token])

  if (cargando) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-gray-400 text-sm">Abriendo tu carnet…</p>
        </div>
      </PublicLayout>
    )
  }

  if (!carnet) {
    return (
      <PublicLayout>
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <h1 className="text-white font-semibold text-lg">Este carnet no existe</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-xs leading-relaxed">
            El link puede estar incompleto, o esta credencial fue dada de baja.
            Escribinos y te mandamos una nueva.
          </p>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-12">
        <div className="w-full max-w-sm">
          {token && <CarnetMiembro carnet={carnet} token={token} />}

          <button
            onClick={() => navigate('/mi-entrada')}
            className="w-full mt-4 bg-neutral-900/80 hover:bg-neutral-800 text-white/55 hover:text-white/80 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
          >
            <Ticket size={15} aria-hidden /> Ver también mis entradas
          </button>

          <p className="text-gray-400 text-[11px] mt-6 text-center leading-relaxed">
            Guardá este link. Este celular ya te reconoce; si cambiás de
            teléfono, abrilo una vez desde el nuevo.
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
