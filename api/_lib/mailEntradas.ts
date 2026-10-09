/// <reference types="node" />
import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { qrPngBase64 } from './qrPng'
import { asuntoMail, htmlMailEntradas } from './mailEntradaHtml'

// Mail con el QR de cada entrada. Única puerta de envío: la usan el registro
// por transferencia (al emitir la entrada) y los dos caminos de Mercado
// Pago (webhook y pantalla de retorno, cuando el pago queda aprobado).
//
// Nunca hace fallar a quien la llama: el mail es un respaldo, no la entrega.
// La entrada ya está en la base y en el dispositivo, así que un Resend caído
// no puede convertirse en "no pude registrarme" ni en un webhook que MP
// reintente para siempre.

/** Qué entradas mandar: las de una persona en un evento, o las de una orden de MP. */
export type AlcanceMail =
  | { eventId: string; email: string }
  | { mpExternalReference: string }

/**
 * Filtro PostgREST espejo de public.entrada_vendida (039), sin la parte de
 * is_banned (va aparte): sin provider, de transferencia, o pagada. MP y la
 * web sin pagar quedan afuera.
 */
export const FILTRO_VENDIDA =
  'payment_provider.is.null,payment_provider.not.in.(mercadopago,web),payment_verified.eq.true'

export interface FilaReclamada {
  id: string
  name: string
  token: string
  email: string
  event_id: string
}

export async function enviarMailEntradas(
  supabase: SupabaseClient,
  alcance: AlcanceMail,
  baseUrl: string
): Promise<{ enviadas: number } | { error: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return { error: 'Falta RESEND_API_KEY' }

    const filas = await reclamar(supabase, alcance)
    if (filas.length === 0) return { enviadas: 0 }

    // Tope de espera: el registro por transferencia espera este envío, y un
    // Resend colgado no puede colgar la emisión de la entrada. Si vence, la
    // marca queda puesta: el mail puede haber salido igual.
    let vencio = false
    const tope = new Promise<never>((_, rechazar) =>
      setTimeout(() => { vencio = true; rechazar(new Error('resend: sin respuesta en 8 s')) }, 8000)
    )

    try {
      await Promise.race([mandar(supabase, filas, apiKey, baseUrl), tope])
      return { enviadas: filas.length }
    } catch (err) {
      if (vencio) throw err
      // Se suelta la marca para que el próximo intento (otra notificación de
      // MP, la pantalla de retorno, un nuevo registro) lo vuelva a probar.
      await supabase
        .from('ticket_registrations')
        .update({ qr_mail_enviado_at: null })
        .in('id', filas.map(f => f.id))
      throw err
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[mail-entradas]', msg)
    return { error: msg }
  }
}

/**
 * Marca como enviadas las filas pendientes y las devuelve, en un solo
 * UPDATE ... RETURNING. Si dos llamadas compiten (webhook y retorno a la
 * vez), Postgres serializa por fila y la segunda no encuentra nada.
 *
 * Sólo entradas que valen: no rechazadas, y si son de MP, con el pago
 * aprobado (espejo de public.entrada_vendida). Una reserva de checkout
 * abierta no tiene que recibir un QR.
 *
 * Y sólo las de Gestión: las vendidas por la web (origen 'web', migración
 * 039) reciben el mail de la web, con la identidad del festival. Sin este
 * filtro, el registro por transferencia —que reclama por evento + email—
 * le mandaría también las de la web a quien compró en los dos lados.
 */
async function reclamar(supabase: SupabaseClient, alcance: AlcanceMail): Promise<FilaReclamada[]> {
  let q = supabase
    .from('ticket_registrations')
    .update({ qr_mail_enviado_at: new Date().toISOString() })
    .is('qr_mail_enviado_at', null)
    .not('is_banned', 'is', true)
    .eq('origen', 'gestion')
    .or(FILTRO_VENDIDA)

  q = 'mpExternalReference' in alcance
    ? q.eq('mp_external_reference', alcance.mpExternalReference)
    : q.eq('event_id', alcance.eventId).eq('email', alcance.email.toLowerCase().trim())

  const { data, error } = await q.select('id, name, token, email, event_id')
  if (error) throw new Error(`reclamar: ${error.message}`)
  return (data ?? []) as FilaReclamada[]
}

/** La dirección de un evento: la suya si la tiene, si no la de Manso. Es la
 *  misma regla que direccionDelEvento en src/lib/entradasStorage.ts. */
function direccionDelEvento(propia: string | null | undefined, general: string | null | undefined): string | null {
  return propia?.trim() || general?.trim() || null
}

/**
 * Manda un mail con estas entradas. Todas tienen que ser del mismo evento y
 * el mismo email (una orden, un registro, o el grupo de un recordatorio).
 */
export async function mandar(
  supabase: SupabaseClient,
  filas: FilaReclamada[],
  apiKey: string,
  baseUrl: string,
  tipo: 'entrada' | 'recordatorio' = 'entrada'
): Promise<void> {
  const { email, event_id } = filas[0]

  const [{ data: evento }, { data: venue }] = await Promise.all([
    supabase
      .from('events')
      .select('name, start_date, direccion')
      .eq('id', event_id)
      .single<{ name: string; start_date: string | null; direccion: string | null }>(),
    supabase
      .from('venue_config')
      .select('direccion')
      .eq('id', 1)
      .single<{ direccion: string }>(),
  ])

  const qrs = await Promise.all(filas.map(f => qrPngBase64(`manso-ticket|${f.token}`)))

  const datos = {
    eventoNombre: evento?.name ?? 'Manso',
    eventoInicio: evento?.start_date ?? null,
    direccion: direccionDelEvento(evento?.direccion, venue?.direccion),
    tipo,
    urlMisEntradas: `${baseUrl}/mi-entrada`,
    entradas: filas.map((f, i) => ({ name: f.name, qrSrc: `cid:qr-${i}` })),
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Manso Club <entradas@mansoclub.com.ar>',
    to: email,
    subject: asuntoMail(datos),
    html: htmlMailEntradas(datos),
    attachments: filas.map((f, i) => ({
      content: qrs[i],
      filename: `entrada-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
      contentType: 'image/png',
      contentId: `qr-${i}`,
    })),
    tags: [{ name: 'tipo', value: tipo }],
  })

  if (error) throw new Error(`resend: ${error.message}`)
}
