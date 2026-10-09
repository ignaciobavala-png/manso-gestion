// Template del mail con las entradas. Separado del envío para poder
// renderizarlo sin Resend ni base (la vista previa usa data: URIs en vez de
// cid:, que es lo único que cambia).
//
// HTML de mail a la antigua a propósito: tablas, estilos inline y el color
// de fondo repetido en `bgcolor`. Gmail app descarta el background CSS de
// varios elementos y, sin las metas de color-scheme, iOS Mail y Gmail
// invierten los colores a su criterio.

export interface EntradaMail {
  name: string
  /** src de la imagen del QR: cid:<id> en el mail real, data: en la vista previa. */
  qrSrc: string
}

export interface DatosMail {
  eventoNombre: string
  /** ISO. Si el evento no tiene fecha, el mail no la muestra. */
  eventoInicio: string | null
  /** Ya resuelta (la del evento o la de Manso). null = no se muestra. */
  direccion: string | null
  /** 'entrada' al emitirla (y al reenviarla); 'recordatorio' es el mail "Es
   *  hoy" del día del evento. 'reenvio' se ve igual que 'entrada'. */
  tipo?: 'entrada' | 'recordatorio' | 'reenvio'
  entradas: EntradaMail[]
  /** Link a /mi-entrada del deploy, con los tokens de este mail (#t=…). */
  urlMisEntradas: string
}

const C = {
  negro: '#000000',
  carbon: '#1D1D1B',
  terra: '#BC2915',
  crema: '#FFFCDC',
  gris: '#9A9A92',
  linea: '#2E2E2B',
}

const FUENTE = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif"

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function fechaLarga(iso: string): string {
  // Argentina fija: el mail se arma en un servidor en UTC.
  const f = new Date(iso)
  const dia = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
  return `${dia} · ${hora} h`
}

function urlMaps(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
}

export function asuntoMail(d: DatosMail): string {
  if (d.tipo === 'recordatorio') {
    return `Hoy es ${d.eventoNombre} — ${d.entradas.length === 1 ? 'tu entrada' : 'tus entradas'}`
  }
  return d.entradas.length === 1
    ? `Tu entrada para ${d.eventoNombre}`
    : `Tus ${d.entradas.length} entradas para ${d.eventoNombre}`
}

function tarjeta(e: EntradaMail, d: DatosMail): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.carbon}" style="background-color:${C.carbon};border-radius:16px;margin:0 0 20px 0;">
  <tr><td height="4" bgcolor="${C.terra}" style="background-color:${C.terra};height:4px;line-height:4px;font-size:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
  <tr><td align="center" style="padding:24px 24px 8px 24px;">
    <p style="margin:0;font-family:${FUENTE};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.gris};">Entrada digital</p>
    <p style="margin:6px 0 0 0;font-family:${FUENTE};font-size:14px;color:${C.terra};font-weight:600;">${esc(d.eventoNombre)}</p>
  </td></tr>
  <tr><td align="center" style="padding:12px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:12px;">
      <tr><td style="padding:8px;">
        <img src="${e.qrSrc}" width="220" height="220" alt="Código QR de la entrada de ${esc(e.name)}" style="display:block;width:220px;height:220px;border:0;">
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:8px 24px 26px 24px;">
    <p style="margin:0;font-family:${FUENTE};font-size:19px;font-weight:700;color:${C.crema};">${esc(e.name)}</p>
    <p style="margin:6px 0 0 0;font-family:${FUENTE};font-size:12px;color:${C.gris};">Mostrá este QR en la puerta.</p>
  </td></tr>
</table>`
}

export function htmlMailEntradas(d: DatosMail): string {
  const varias = d.entradas.length > 1
  const fecha = d.eventoInicio ? fechaLarga(d.eventoInicio) : null
  const recordatorio = d.tipo === 'recordatorio'
  const titulo = recordatorio ? 'Es hoy' : varias ? 'Ya tenés tus entradas' : 'Ya tenés tu entrada'
  const lugar = d.direccion
    ? `<br><span style="color:${C.gris};">${esc(d.direccion)}</span> &nbsp;<a href="${esc(urlMaps(d.direccion))}" style="color:${C.terra};font-weight:600;text-decoration:underline;">Cómo llegar</a>`
    : ''

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(asuntoMail(d))}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.negro};" bgcolor="${C.negro}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${recordatorio ? 'Es hoy: ' : ''}${varias ? 'Tus QR' : 'Tu QR'} para entrar a ${esc(d.eventoNombre)}${fecha ? ` — ${esc(fecha)}` : ''}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.negro}" style="background-color:${C.negro};">
<tr><td align="center" style="padding:32px 16px 40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;">

    <tr><td align="center" style="padding:0 0 28px 0;">
      <p style="margin:0;font-family:${FUENTE};font-size:26px;font-weight:800;letter-spacing:6px;color:${C.crema};">MANSO</p>
    </td></tr>

    <tr><td style="padding:0 4px 24px 4px;">
      <p style="margin:0;font-family:${FUENTE};font-size:22px;line-height:1.25;font-weight:700;color:${C.crema};">${titulo}</p>
      <p style="margin:10px 0 0 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:${C.crema};">${esc(d.eventoNombre)}${fecha ? `<br><span style="color:${C.gris};">${esc(fecha)}</span>` : ''}${lugar}</p>
    </td></tr>

    <tr><td>${d.entradas.map(e => tarjeta(e, d)).join('')}</td></tr>

    ${varias ? `
    <tr><td style="padding:4px 4px 20px 4px;">
      <p style="margin:0;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${C.crema};">Cada persona entra con su propio QR: reenviale a cada una el suyo.</p>
    </td></tr>` : ''}

    <tr><td align="center" style="padding:8px 0 28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.terra}" style="background-color:${C.terra};border-radius:12px;">
        <tr><td align="center" style="background-color:${C.terra};border-radius:12px;">
          <a href="${esc(d.urlMisEntradas)}" style="display:inline-block;padding:14px 26px;font-family:${FUENTE};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;background-color:${C.terra};border-radius:12px;">Ver en la app</a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="border-top:1px solid ${C.linea};padding:20px 4px 0 4px;">
      <p style="margin:0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${C.gris};">No necesitás internet en la puerta: con mostrar este mail o una captura alcanza. Si perdés el mail, desde la app te lo volvemos a mandar a esta misma dirección.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`
}
