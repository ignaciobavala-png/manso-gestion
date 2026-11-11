import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Pagina, Rotulo, Titulo } from '../components/Mock'
import { Textura } from '../components/Textura'
import { useFestival } from '../lib/festival'
import {
  codigoCorto,
  consultar,
  guardarTokens,
  linkDeRespaldo,
  olvidarTokens,
  pedirPorMail,
  recuperarPorCodigo,
  tokensDelLink,
  type Entrada,
  type ResultadoCodigo,
} from '../lib/cuenta'

const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent
/** Navegador interno de Instagram / Facebook / WhatsApp: su almacenamiento no es el de Safari. */
const EN_APP = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(UA)
const EN_IPHONE = /iPhone|iPad|iPod/i.test(UA)

const MENSAJES_CODIGO: Record<Exclude<ResultadoCodigo, 'ok'>, string> = {
  codigo_invalido: 'El código tiene 10 caracteres (letras y números), junto al QR. También sirve el link entero.',
  no_encontrada: 'No encontramos una entrada con ese código. Revisá que esté bien escrito.',
  ambiguo: 'Ese código coincide con más de una entrada. Pegá el link entero del mail.',
  demasiados_intentos: 'Probaste muchas veces. Esperá unos minutos y volvé a intentar.',
  error: 'No pudimos buscar la entrada. Revisá la conexión y probá de nuevo.',
}

/** El QR que lee la puerta de Gestión: `manso-ticket|<token>`. Se dibuja acá, no se guarda como imagen. */
function Qr({ token }: { token: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    // Negro sobre blanco y sin color de marca: el lector tiene que leerlo siempre.
    QRCode.toCanvas(ref.current, `manso-ticket|${token}`, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).catch(() => {})
  }, [token])
  return <canvas ref={ref} width={240} height={240} className="mx-auto block h-60 w-60 rounded bg-white" aria-label="Código QR de la entrada" />
}

function TarjetaEntrada({ e, n }: { e: Entrada | { token: string; sinVerificar: true }; n: number }) {
  const verificada = 'estado' in e
  const estado = verificada ? e.estado : null
  const muestraQr = estado === null || estado === 'valida' || estado === 'usada'
  return (
    <li className="border border-linea bg-superficie p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-apagado">
        {verificada ? e.ticket_type_nombre ?? 'Entrada' : 'Entrada'}
        {verificada && e.pack_size && e.pack_size > 1 && e.pack_pos ? ` · ${e.pack_pos} de ${e.pack_size}` : ''}
      </p>
      {verificada && <p className="titulo mt-1 text-3xl">{e.name}</p>}

      {muestraQr ? (
        <div className="mt-4">
          <Qr token={e.token} />
          <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-apagado">Código</p>
          <p className="text-center font-mono text-2xl font-bold tracking-[0.15em]">{codigoCorto(e.token)}</p>
          {estado === 'usada' && <p className="mt-2 text-center text-sm text-apagado">Esta entrada ya pasó por la puerta.</p>}
          {estado === null && <p className="mt-2 text-center text-sm text-apagado">Sin conexión: no pudimos confirmar el estado. El QR sirve igual.</p>}
        </div>
      ) : estado === 'pendiente' ? (
        <p className="mt-3">Tu pago todavía no está confirmado. Cuando se acredite, el QR aparece acá solo.</p>
      ) : (
        <p className="mt-3">Esta entrada fue anulada. Si creés que es un error, escribinos.</p>
      )}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-apagado">Entrada {n}</p>
    </li>
  )
}

function Contacto() {
  const f = useFestival()
  const cfg = !f.cargando && f.error === null ? f.data.config : null
  const ig = cfg?.instagram ?? 'blur.festival'
  const mail = cfg?.email ?? 'comercial@mansoclub.com.ar'
  return (
    <p className="mt-3 text-sm text-apagado">
      ¿Nada funciona? Escribinos por Instagram{' '}
      <a className="underline" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">
        @{ig}
      </a>{' '}
      o a{' '}
      <a className="underline" href={`mailto:${mail}`}>
        {mail}
      </a>{' '}
      con el mail o el nombre de la compra.
    </p>
  )
}

function NoPuedoEntrar({ alRecuperar }: { alRecuperar: (tokens: string[]) => void }) {
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mail, setMail] = useState('')
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [mandando, setMandando] = useState(false)

  const buscar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (buscando || !codigo.trim()) return
    setBuscando(true)
    setError(null)
    const r = await recuperarPorCodigo(codigo)
    setBuscando(false)
    if (r.estado === 'ok') {
      setCodigo('')
      alRecuperar(r.tokens)
    } else setError(MENSAJES_CODIGO[r.estado])
  }

  const mandar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (mandando || !mail.trim()) return
    setMandando(true)
    const r = await pedirPorMail(mail.trim())
    setMandando(false)
    setMailMsg({ ok: r.ok, texto: r.mensaje })
  }

  const campo = 'mt-2 w-full border border-linea bg-transparent px-3 py-3 font-mono text-base outline-none focus:border-acento'
  const boton = 'mt-3 border border-acento px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-acento disabled:opacity-50'

  return (
    <div className="space-y-8">
      {EN_APP && (
        <p className="border border-resalte p-3 text-sm">
          Estás en el navegador de una app (Instagram, WhatsApp…). Lo que guarda no se comparte con Safari ni con Chrome. Abrí esta página en el
          navegador del teléfono (menú <b>···</b> → “Abrir en el navegador”) o usá una de las opciones de abajo.
        </p>
      )}
      {EN_IPHONE && !EN_APP && (
        <p className="text-sm text-apagado">
          En iPhone, Safari borra lo guardado si pasan varios días sin abrir la página. No pasa nada: con el código de la entrada la recuperás en
          un momento.
        </p>
      )}

      <form onSubmit={buscar}>
        <p className="font-bold">1 · Con el código de tu entrada</p>
        <p className="text-sm text-apagado">Son los 10 caracteres junto al QR del mail. También podés pegar el link entero.</p>
        <input
          className={campo}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Ej. 3F9A1C27B0"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Código de la entrada"
        />
        <button className={boton} disabled={buscando || !codigo.trim()}>
          {buscando ? 'Buscando…' : 'Recuperar mi entrada'}
        </button>
        {error && <p className="mt-3 text-sm text-resalte">{error}</p>}
      </form>

      <form onSubmit={mandar}>
        <p className="font-bold">2 · Que te la mandemos por mail</p>
        <p className="text-sm text-apagado">Escribí el mail de la compra. Si hay entradas, te llega un mail con el link.</p>
        <input
          className={campo}
          type="email"
          inputMode="email"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          placeholder="tu@mail.com"
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Mail de la compra"
        />
        <button className={boton} disabled={mandando || !mail.trim()}>
          {mandando ? 'Enviando…' : 'Mandarme el mail'}
        </button>
        {mailMsg && <p className={`mt-3 text-sm ${mailMsg.ok ? '' : 'text-resalte'}`}>{mailMsg.texto}</p>}
      </form>

      <div>
        <p className="font-bold">3 · Hablar con una persona</p>
        <Contacto />
      </div>
    </div>
  )
}

/**
 * Mi cuenta: las entradas de esta persona, sin login. Reconoce el teléfono por
 * el token guardado, o por el link `/cuenta#t=…` del mail, y si nada de eso
 * anda ofrece "No puedo entrar" (código de la entrada, mail o contacto).
 */
export default function Cuenta() {
  const [tokens, setTokens] = useState<string[]>(() => guardarTokens(tokensDelLink()))
  const [entradas, setEntradas] = useState<Entrada[] | null | undefined>(undefined) // undefined = cargando
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // El token sale de la barra de direcciones una vez guardado: no queda en capturas ni al compartir la pantalla.
  useEffect(() => {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  useEffect(() => {
    let vivo = true
    if (tokens.length === 0) {
      setEntradas([])
      return
    }
    setEntradas(undefined)
    consultar(tokens).then((r) => vivo && setEntradas(r))
    return () => {
      vivo = false
    }
  }, [tokens])

  const recuperar = useCallback((nuevos: string[]) => {
    setTokens(guardarTokens(nuevos))
    setAbierto(false)
  }, [])

  const copiarRespaldo = async () => {
    try {
      await navigator.clipboard.writeText(linkDeRespaldo(tokens))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copiá este link y guardalo (notas, WhatsApp a vos mismo):', linkDeRespaldo(tokens))
    }
  }

  const salir = () => {
    olvidarTokens()
    setTokens([])
  }

  // Sin consulta (sin señal) se muestran los tokens guardados igual: el QR sale del token.
  const lista: (Entrada | { token: string; sinVerificar: true })[] =
    entradas === undefined ? [] : entradas === null ? tokens.map((token) => ({ token, sinVerificar: true as const })) : entradas
  const hayEntradas = lista.length > 0

  return (
    <div className="textura">
      <Textura tipo="pasto" suave />
      <Pagina>
        <Rotulo>Mi cuenta</Rotulo>
        <Titulo className="mt-5">Mi entrada</Titulo>

        {entradas === undefined && <p className="mt-10 text-apagado">Buscando tus entradas…</p>}

        {entradas !== undefined && !hayEntradas && tokens.length === 0 && (
          <p className="mt-8">
            Este teléfono todavía no tiene entradas guardadas. Abrí el link del mail de tu compra, o recuperala con el botón de abajo.
          </p>
        )}

        {entradas !== undefined && tokens.length > 0 && !hayEntradas && (
          <p className="mt-8">No encontramos esas entradas. Probá recuperarlas con el botón de abajo.</p>
        )}

        {hayEntradas && (
          <ul className="mt-8 space-y-6">
            {lista.map((e, i) => (
              <TarjetaEntrada key={e.token} e={e} n={i + 1} />
            ))}
          </ul>
        )}

        {tokens.length > 0 && (
          <div className="mt-8 border-t border-linea pt-6">
            <p className="font-bold">Guardá un respaldo</p>
            <p className="text-sm text-apagado">
              Copiá tu link y mandátelo por WhatsApp o guardalo en notas. Si el teléfono pierde la sesión, abrirlo la recupera.
            </p>
            <button
              onClick={copiarRespaldo}
              className="mt-3 border border-acento px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-acento"
            >
              {copiado ? 'Link copiado' : 'Copiar mi link'}
            </button>
          </div>
        )}

        <div className="mt-10 border-t border-linea pt-6">
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="font-mono text-sm font-bold uppercase tracking-[0.15em] underline underline-offset-4"
          >
            No puedo entrar
          </button>
          {abierto && (
            <div className="mt-6">
              <NoPuedoEntrar alRecuperar={recuperar} />
            </div>
          )}
        </div>

        {tokens.length > 0 && (
          <button onClick={salir} className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-apagado underline underline-offset-4">
            Sacar mis entradas de este teléfono
          </button>
        )}
      </Pagina>
    </div>
  )
}
