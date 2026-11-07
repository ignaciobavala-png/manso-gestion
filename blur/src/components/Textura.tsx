import llamasSvg from '../assets/textura_1_color.svg?raw'
import pastoSvg from '../assets/textura_1_b.svg?raw'

/**
 * Los trazos de la marca, con movimiento muy leve. Cada trazo es un <path>
 * del SVG original y se anima por separado, con fase y duración distintas
 * según su posición, para que no se mueva todo al unísono (eso se vería como
 * una imagen temblando). El dibujo no cambia: cada trazo gira o se estira unos
 * pocos grados alrededor de su base.
 *
 *  · llamas: titileo corto, para el bloque naranja de Escenarios.
 *  · pasto:  vaivén lento, como el pasto con viento, para el Line up.
 *
 * Va inline (no como <img> ni background) porque los <path> de un SVG externo
 * no se pueden animar desde el CSS de la página.
 */

const VIEWBOX = '0 0 1062.17 942.44'

/** Deja solo los trazos: sin <style> propio (sus clases chocarían entre las dos texturas), ids ni cabecera XML. */
const trazos = (svg: string) =>
  svg
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\sid="[^"]*"/g, '')
    .replace(/\sdata-name="[^"]*"/g, '')

const MARCADO = {
  llamas: trazos(llamasSvg),
  pasto: trazos(pastoSvg),
}

export function Textura({ tipo }: { tipo: 'llamas' | 'pasto' }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={VIEWBOX}
      fill="currentColor"
      className={`textura-viva ${tipo}`}
      dangerouslySetInnerHTML={{ __html: MARCADO[tipo] }}
    />
  )
}
