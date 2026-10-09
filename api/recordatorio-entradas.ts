/// <reference types="node" />
import { adminClient, resolverBaseUrl } from './_lib/registro'
import { mandar, FILTRO_VENDIDA, type FilaReclamada } from './_lib/mailEntradas'

export const config = {
  runtime: 'edge'
}

// PAUSADO (05/10/26): no está en los crons de vercel.json. Con el mail del QR
// al sacar la entrada alcanzaba, y esto duplicaba el volumen de Resend. Para
// prenderlo, volver a agregar en vercel.json:
//   { "path": "/api/recordatorio-entradas", "schedule": "0,10,20 12 * * *" }
//
// Mail "Es hoy": la mañana del evento, a quien tenga entrada, con el QR y la
// dirección. Lo dispara el cron de vercel.json a las 9 (12 UTC) y de nuevo
// a las 9:10 y 9:20: un evento grande pasa los 700 mails y Resend deja
// mandar 2 por segundo, así que no entra en una sola corrida. Cada corrida
// sigue donde quedó la anterior porque lo enviado queda marcado.
//
// En edge hay que empezar a responder antes de los 25 s, pero se puede seguir
// hasta los 300 s mientras se transmite: por eso la respuesta es un stream
// que va contando lo que manda.

/** Qué eventos entran: los que empiezan entre ahora y 21 horas después. A las
 *  9 eso llega hasta las 6 de mañana, que cubre la noche entera y el que
 *  arranca después de medianoche. */
const VENTANA_MS = 21 * 60 * 60 * 1000

/** Quien sacó la entrada hace menos de esto ya tiene el mail de la entrada
 *  fresco: un segundo mail con lo mismo es ruido. */
const RECIENTE_MS = 12 * 60 * 60 * 1000

/** Por debajo del límite de 2 por segundo de Resend. */
const PAUSA_MS = 600

/** Se corta antes de los 300 s de edge; lo que falte lo toma la corrida siguiente. */
const PRESUPUESTO_MS = 270 * 1000

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

export default async function handler(req: Request): Promise<Response> {
  // Vercel manda el CRON_SECRET en cada disparo del cron. Sin el secreto
  // configurado no se corre: cualquiera podría adelantar los mails.
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return new Response('No autorizado', { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return new Response('Falta RESEND_API_KEY', { status: 500 })

  const baseUrl = resolverBaseUrl(req)
  const supabase = adminClient()
  const inicio = Date.now()
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      const log = (s: string) => {
        console.log('[recordatorio]', s)
        ctrl.enqueue(enc.encode(s + '\n'))
      }

      try {
        const ahora = new Date()
        const { data: eventos, error: errEv } = await supabase
          .from('events')
          .select('id, name')
          .is('closed_at', null)
          .gte('start_date', ahora.toISOString())
          .lt('start_date', new Date(ahora.getTime() + VENTANA_MS).toISOString())
        if (errEv) throw new Error(`eventos: ${errEv.message}`)
        if (!eventos || eventos.length === 0) {
          log('sin eventos hoy')
          return
        }

        // Mismo criterio que el mail de la entrada (reclamar en
        // mailEntradas.ts): no rechazadas, si son de MP pagadas, y sólo las
        // de Gestión (las de la web las avisa la web).
        const { data: pendientes, error: errPend } = await supabase
          .from('ticket_registrations')
          .select('id, name, token, email, event_id')
          .in('event_id', eventos.map(e => e.id))
          .is('recordatorio_enviado_at', null)
          .not('is_banned', 'is', true)
          .eq('origen', 'gestion')
          .or(FILTRO_VENDIDA)
          .lt('registered_at', new Date(ahora.getTime() - RECIENTE_MS).toISOString())
          // PostgREST corta en 1000 filas. Lo que no entre queda sin marcar
          // y lo levanta la corrida de las 9:10.
          .limit(1000)
        if (errPend) throw new Error(`pendientes: ${errPend.message}`)

        // Un mail por persona y evento, con todas sus entradas adentro.
        const grupos = new Map<string, FilaReclamada[]>()
        for (const f of (pendientes ?? []) as FilaReclamada[]) {
          const clave = `${f.event_id}|${f.email.toLowerCase().trim()}`
          grupos.set(clave, [...(grupos.get(clave) ?? []), f])
        }
        log(`${eventos.map(e => e.name).join(', ')}: ${grupos.size} mails pendientes`)

        let enviados = 0
        let fallidos = 0
        for (const grupo of grupos.values()) {
          if (Date.now() - inicio > PRESUPUESTO_MS) {
            log(`tiempo agotado: quedan ${grupos.size - enviados - fallidos} para la próxima corrida`)
            break
          }

          // Se reclama justo antes de mandar, con el mismo UPDATE ... WHERE
          // IS NULL RETURNING de siempre: si dos corridas se pisan, la
          // segunda no encuentra nada.
          const { data: reclamadas } = await supabase
            .from('ticket_registrations')
            .update({ recordatorio_enviado_at: new Date().toISOString() })
            .in('id', grupo.map(f => f.id))
            .is('recordatorio_enviado_at', null)
            .select('id, name, token, email, event_id')
          if (!reclamadas || reclamadas.length === 0) continue

          try {
            await mandar(supabase, reclamadas as FilaReclamada[], apiKey, baseUrl, 'recordatorio')
            enviados++
          } catch (err) {
            fallidos++
            log(`falló ${grupo[0].email.replace(/(.{2}).*@/, '$1…@')}: ${err instanceof Error ? err.message : String(err)}`)
            // Se suelta para que la corrida siguiente lo reintente.
            await supabase
              .from('ticket_registrations')
              .update({ recordatorio_enviado_at: null })
              .in('id', reclamadas.map(f => f.id))
          }
          await esperar(PAUSA_MS)
        }
        log(`listo: ${enviados} enviados, ${fallidos} fallidos`)
      } catch (err) {
        log(`error: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        ctrl.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
