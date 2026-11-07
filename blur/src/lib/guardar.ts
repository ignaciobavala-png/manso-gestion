import type { FotoRollo } from './revelado'

const dos = (n: number) => String(n).padStart(2, '0')

/** Baja las fotos como archivos. Se hace al abrir el rollo, no al apretar el botón (ver abajo). */
export function prepararArchivos(fotos: FotoRollo[], numero: string | null): Promise<File[]> {
  const etiqueta = numero ?? 'rollo'
  return Promise.all(
    fotos.map(async (f) => {
      const res = await fetch(f.url)
      if (!res.ok) throw new Error(`No se pudo bajar la foto ${f.n}`)
      return new File([await res.blob()], `blur-${etiqueta}-${dos(f.n)}.jpg`, { type: 'image/jpeg' })
    }),
  )
}

export type Guardado = 'compartido' | 'zip' | 'cancelado'

/**
 * Guarda las fotos en el teléfono. En celulares con hoja de compartir va todo de
 * una ("Guardar imágenes" las pone en el carrete); si no se puede, baja un .zip.
 *
 * Los archivos tienen que estar bajados ANTES del toque: `navigator.share`
 * exige que se llame dentro del gesto del usuario, y esperar la red primero lo
 * vence (Safari lo rechaza).
 */
export async function guardarFotos(archivos: File[], numero: string | null): Promise<Guardado> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: archivos })) {
    try {
      await navigator.share({ files: archivos, title: 'Mi rollo BLUR' })
      return 'compartido'
    } catch (e) {
      // Cerrar la hoja sin elegir nada no es un error ni pide el zip.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Cualquier otra falla de la hoja de compartir: se cae al zip.
    }
  }

  const { zipSync } = await import('fflate')
  const contenido: Record<string, Uint8Array> = {}
  for (const a of archivos) contenido[a.name] = new Uint8Array(await a.arrayBuffer())
  // JPEG ya viene comprimido: nivel 0 (solo agrupa), así es instantáneo.
  const zip = zipSync(contenido, { level: 0 })

  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  enlace.download = `blur-${numero ?? 'rollo'}.zip`
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
  return 'zip'
}
