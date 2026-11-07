/** Sonido y vibración de la cámara. Todo es opcional: si el navegador no puede, no pasa nada. */
let ctx: AudioContext | null = null

/** Chasquido corto de ruido filtrado. `suave` es el tic de la rueda; si no, el obturador. */
export function clic(suave = false) {
  try {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()

    const dur = suave ? 0.02 : 0.06
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)

    const src = ctx.createBufferSource()
    src.buffer = buf
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.frequency.value = suave ? 3200 : 1100
    const gain = ctx.createGain()
    gain.gain.value = suave ? 0.25 : 0.7
    src.connect(filtro).connect(gain).connect(ctx.destination)
    src.start()
  } catch {
    // sin audio
  }
}

export function vibrar(patron: number | number[]) {
  try {
    navigator.vibrate?.(patron)
  } catch {
    // sin vibración (iOS)
  }
}
