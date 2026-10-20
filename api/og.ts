/// <reference types="node" />
import { adminClient } from './_lib/registro'

export const config = {
  runtime: 'edge'
}

// Vista previa del link de un evento (WhatsApp, Instagram, Telegram). Los
// rastreadores leen el HTML sin ejecutar JavaScript, y esta web es una SPA: el
// index.html es el mismo para todas las rutas. Acá se toma ese index.html y se
// le cambian las etiquetas por las del evento (nombre, fecha, flyer).
//
// Lo que se sirve es la misma página de siempre: a un navegador le da igual
// que haya pasado por acá. Por eso, ante cualquier falla —la base, el evento
// que no existe— se devuelve el index.html sin tocar. Esta ruta está en el
// camino de la compra: no puede ser un punto de falla.

interface FilaEvento {
  name: string
  start_date: string | null
  direccion: string | null
  flyer_url: string | null
  is_private: boolean | null
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9-]{1,100}$/i

function origenPublico(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return host ? `https://${host}` : new URL(req.url).origin
}

async function buscarEvento(slug: string | null, id: string | null): Promise<FilaEvento | null> {
  const q = adminClient()
    .from('events')
    .select('name, start_date, direccion, flyer_url, is_private')
  const { data, error } = slug && SLUG_RE.test(slug)
    ? await q.eq('slug', slug).maybeSingle<FilaEvento>()
    : id && UUID_RE.test(id)
      ? await q.eq('id', id).maybeSingle<FilaEvento>()
      : { data: null, error: null }
  if (error) throw error
  return data
}

function conEtiquetas(html: string, ev: FilaEvento, origen: string, url: string): string {
  const titulo = `${ev.name} — Manso Club`
  const partes = [ev.start_date ? fecha(ev.start_date) : null, ev.direccion].filter(Boolean)
  const descripcion = partes.length > 0 ? `${partes.join(' · ')}. Sacá tu entrada.` : 'Sacá tu entrada.'
  const imagen = ev.flyer_url && /^https:\/\//.test(ev.flyer_url) ? ev.flyer_url : `${origen}/og-default.png`
  // Con flyer propio no se sabe el tamaño: se sacan las medidas del default.
  const medidas = imagen === ev.flyer_url ? '' : '<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />'

  const limpio = html
    .replace(/<meta\s+(?:property|name)="(?:og|twitter):(?:title|description|image|image:width|image:height|url|card)"[^>]*>\s*/g, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`)

  const etiquetas = [
    `<meta name="description" content="${esc(descripcion)}" />`,
    `<meta property="og:title" content="${esc(titulo)}" />`,
    `<meta property="og:description" content="${esc(descripcion)}" />`,
    `<meta property="og:image" content="${esc(imagen)}" />`,
    medidas,
    `<meta property="og:url" content="${esc(url)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ')

  return limpio.replace('</head>', `    ${etiquetas}\n  </head>`)
}

export default async function handler(req: Request): Promise<Response> {
  const origen = origenPublico(req)
  const shell = await fetch(`${origen}/index.html`)
  if (!shell.ok) return new Response('No disponible', { status: 502 })
  const html = await shell.text()

  const cabeceras = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }

  try {
    const url = new URL(req.url)
    const ev = await buscarEvento(url.searchParams.get('slug'), url.searchParams.get('event'))
    // Un evento privado no se muestra por fuera: quien tiene el link entra,
    // pero el nombre y el flyer no tienen que viajar por la vista previa.
    if (!ev || ev.is_private) return new Response(html, { status: 200, headers: cabeceras })

    const pagina = url.searchParams.get('slug')
      ? `${origen}/registro/${encodeURIComponent(url.searchParams.get('slug')!)}`
      : `${origen}/registro?event=${encodeURIComponent(url.searchParams.get('event')!)}`
    return new Response(conEtiquetas(html, ev, origen, pagina), { status: 200, headers: cabeceras })
  } catch (err) {
    console.error('[og]', err instanceof Error ? err.message : err)
    return new Response(html, { status: 200, headers: cabeceras })
  }
}
