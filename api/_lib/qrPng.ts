// QR → PNG sin canvas, sin zlib y sin fs.
//
// Las funciones corren en edge runtime, donde el renderer PNG de `qrcode`
// (pngjs, que usa zlib de Node) no existe. Se toma sólo el núcleo de la
// librería, que calcula la matriz de módulos en JS puro, y el PNG se arma a
// mano: escala de grises de 8 bits, comprimido con CompressionStream, que es
// estándar web y sí está en edge. 'deflate' produce formato zlib, que es
// justo lo que PNG espera adentro del chunk IDAT.

// @ts-expect-error — el núcleo no publica tipos; la API que se usa es create().
import QRCodeCore from 'qrcode/lib/core/qrcode'

interface Matriz { size: number; data: Uint8Array }

const crcTabla = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo: string, datos: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + datos.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, datos.length)
  out.set(new TextEncoder().encode(tipo), 4)
  out.set(datos, 8)
  v.setUint32(8 + datos.length, crc32(out.subarray(4, 8 + datos.length)))
  return out
}

async function deflate(datos: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([datos]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * PNG del QR, en base64 (lo que espera un adjunto de Resend).
 * `escala` son píxeles por módulo; `margen` en módulos (4 es lo que pide la
 * norma para que los lectores lo encuentren).
 */
export async function qrPngBase64(texto: string, escala = 10, margen = 4): Promise<string> {
  const { modules } = QRCodeCore.create(texto, { errorCorrectionLevel: 'M' }) as { modules: Matriz }
  const lado = (modules.size + margen * 2) * escala

  // Cada fila arranca con el byte de filtro (0 = ninguno). 255 blanco, 0 negro.
  const crudo = new Uint8Array(lado * (lado + 1))
  for (let y = 0; y < lado; y++) {
    const fila = y * (lado + 1)
    crudo[fila] = 0
    const my = Math.floor(y / escala) - margen
    for (let x = 0; x < lado; x++) {
      const mx = Math.floor(x / escala) - margen
      const oscuro = my >= 0 && mx >= 0 && my < modules.size && mx < modules.size &&
        modules.data[my * modules.size + mx] === 1
      crudo[fila + 1 + x] = oscuro ? 0 : 255
    }
  }

  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, lado)
  v.setUint32(4, lado)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 0 // escala de grises

  const partes = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(crudo)),
    chunk('IEND', new Uint8Array()),
  ]
  const png = new Uint8Array(partes.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of partes) { png.set(p, o); o += p.length }

  let bin = ''
  for (let i = 0; i < png.length; i += 0x8000) {
    bin += String.fromCharCode(...png.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}
