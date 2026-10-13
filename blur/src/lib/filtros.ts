/**
 * Filtros de la cámara analógica. Cada uno es una receta (no un CSS suelto)
 * para que la foto guardada se vea igual que el visor: el visor usa la versión
 * CSS aproximada y la foto se procesa píxel a píxel en un canvas, porque
 * `ctx.filter` no existe en todos los Safari.
 */
export interface Filtro {
  id: string
  nombre: string
  nota: string
  /** Aproximación para el visor en vivo. */
  css: string
  /** Multiplicadores por canal (cálido > 1 en R, frío > 1 en B). */
  tinte: [number, number, number]
  contraste: number
  brillo: number
  saturacion: number
  /** Levanta los negros: look desteñido. 0–60. */
  fade: number
  /** Intensidad del grano, 0–40. */
  grano: number
  /** Oscurecimiento de las esquinas, 0–1. */
  vineta: number
  /** Fecha naranja abajo a la derecha, como las compactas de los 90. */
  fecha?: boolean
}

export const FILTROS: Filtro[] = [
  {
    id: 'gold', nombre: 'Gold 200', nota: 'Cálida, de verano',
    css: 'sepia(0.25) saturate(1.3) contrast(1.05) brightness(1.04)',
    tinte: [1.06, 1, 0.88], contraste: 1.05, brillo: 1.04, saturacion: 1.25, fade: 6, grano: 14, vineta: 0.25, fecha: true,
  },
  {
    id: 'tri-x', nombre: 'Tri-X 400', nota: 'Blanco y negro, grano grueso',
    css: 'grayscale(1) contrast(1.3) brightness(1.02)',
    tinte: [1, 1, 1], contraste: 1.3, brillo: 1.02, saturacion: 0, fade: 4, grano: 34, vineta: 0.35,
  },
  {
    id: 'polaroid', nombre: 'Instante', nota: 'Desteñida, negros lavados',
    css: 'sepia(0.15) saturate(0.85) contrast(0.88) brightness(1.1)',
    tinte: [1.03, 1, 0.97], contraste: 0.88, brillo: 1.08, saturacion: 0.85, fade: 38, grano: 10, vineta: 0.15,
  },
  {
    id: 'cross', nombre: 'Cross', nota: 'Revelada mal, a propósito',
    css: 'hue-rotate(-18deg) saturate(1.6) contrast(1.25)',
    tinte: [0.92, 1.08, 1.12], contraste: 1.25, brillo: 1, saturacion: 1.5, fade: 10, grano: 18, vineta: 0.3,
  },
  {
    id: 'fuji', nombre: 'Verde 400', nota: 'Sombras verdes, frescas',
    css: 'saturate(1.1) hue-rotate(8deg) contrast(1.05)',
    tinte: [0.95, 1.06, 0.98], contraste: 1.06, brillo: 1.02, saturacion: 1.1, fade: 14, grano: 16, vineta: 0.2,
  },
  {
    id: 'noche', nombre: 'Noche 800', nota: 'Flash duro, muy de club',
    css: 'contrast(1.4) saturate(1.15) brightness(0.92)',
    tinte: [1.04, 0.98, 1.02], contraste: 1.4, brillo: 0.92, saturacion: 1.15, fade: 2, grano: 30, vineta: 0.55, fecha: true,
  },
  {
    id: 'limpio', nombre: 'Sin filtro', nota: 'Tal cual',
    css: 'none',
    tinte: [1, 1, 1], contraste: 1, brillo: 1, saturacion: 1, fade: 0, grano: 0, vineta: 0,
  },
]

export const filtroPorId = (id: string) => FILTROS.find((f) => f.id === id) ?? FILTROS[0]

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** Procesa lo que ya está dibujado en el canvas. */
export function aplicarFiltro(canvas: HTMLCanvasElement, f: Filtro, fecha: Date) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const cx = w / 2
  const cy = h / 2
  const maxD = Math.hypot(cx, cy)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = d[i], g = d[i + 1], b = d[i + 2]

      const l = 0.299 * r + 0.587 * g + 0.114 * b
      r = l + (r - l) * f.saturacion
      g = l + (g - l) * f.saturacion
      b = l + (b - l) * f.saturacion

      r = (r - 128) * f.contraste + 128
      g = (g - 128) * f.contraste + 128
      b = (b - 128) * f.contraste + 128

      r *= f.brillo * f.tinte[0]
      g *= f.brillo * f.tinte[1]
      b *= f.brillo * f.tinte[2]

      if (f.fade) {
        const k = 1 - f.fade / 255
        r = f.fade + r * k
        g = f.fade + g * k
        b = f.fade + b * k
      }

      if (f.grano) {
        const n = (Math.random() - 0.5) * 2 * f.grano
        r += n; g += n; b += n
      }

      if (f.vineta) {
        const dist = Math.hypot(x - cx, y - cy) / maxD
        const v = 1 - f.vineta * Math.pow(dist, 2.2)
        r *= v; g *= v; b *= v
      }

      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b)
    }
  }
  ctx.putImageData(img, 0, 0)

  if (f.fecha) {
    const yy = String(fecha.getFullYear()).slice(2)
    const mm = String(fecha.getMonth() + 1).padStart(2, '0')
    const dd = String(fecha.getDate()).padStart(2, '0')
    const px = Math.round(w * 0.04)
    ctx.font = `700 ${px}px "Space Mono", monospace`
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ff8a2b'
    ctx.shadowColor = 'rgba(255,90,0,.7)'
    ctx.shadowBlur = px * 0.35
    ctx.fillText(`'${yy} ${mm} ${dd}`, w - px, h - px)
    ctx.shadowBlur = 0
  }
}
