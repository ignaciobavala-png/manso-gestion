/* Service worker de Manso. Un solo objetivo: que /mi-entrada abra aunque no
   haya señal en la puerta. Las entradas ya viven en el dispositivo
   (localStorage); lo que faltaba era que la página misma cargara sin red.

   Qué guarda y qué no:
   - La página (index.html): primero la red, y si tarda más de 3 s o no hay,
     la copia guardada. Online siempre se ve la versión nueva.
   - /assets/* (JS y CSS con hash en el nombre): se guardan al pedirlos. Un
     archivo con hash nunca cambia de contenido, así que servirlo guardado es
     siempre correcto.
   - Nada de /api, ni de Supabase, ni de otros dominios: los datos no se
     cachean acá; el que decide qué mostrar sin conexión es la app. */

const CACHE = 'manso-v1'
const SHELL = '/index.html'
const ESPERA_RED_MS = 3000
const MAX_ASSETS = 80

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/** Para que los assets viejos no se acumulen para siempre. */
async function recortar(cache) {
  const claves = await cache.keys()
  const assets = claves.filter(r => new URL(r.url).pathname.startsWith('/assets/'))
  await Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map(r => cache.delete(r)))
}

async function pagina(request, evento) {
  const cache = await caches.open(CACHE)
  const guardada = await cache.match(SHELL)

  const red = fetch(request).then(res => {
    // Con la red andando, se renueva la copia: así lo guardado siempre
    // apunta a los assets de la versión que se acaba de ver.
    evento.waitUntil(
      fetch(SHELL, { cache: 'no-cache' })
        .then(r => (r.ok ? cache.put(SHELL, r) : undefined))
        .catch(() => {})
    )
    return res
  })

  if (!guardada) return red
  const tope = new Promise(resolve => setTimeout(() => resolve(null), ESPERA_RED_MS))
  try {
    return (await Promise.race([red, tope])) ?? guardada
  } catch {
    return guardada
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(request)
  if (guardado) return guardado
  const res = await fetch(request)
  if (res.ok) {
    await cache.put(request, res.clone())
    await recortar(cache)
  }
  return res
}

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    e.respondWith(pagina(request, e))
  } else if (url.pathname.startsWith('/assets/')) {
    e.respondWith(asset(request))
  }
})
