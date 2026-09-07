import {
  Armchair, Wifi, Coffee, VolumeX, Plug, Leaf, Printer, Laptop,
  UtensilsCrossed, Headphones, CalendarDays, Ticket, Clapperboard, Beer,
  Smartphone, Banknote, CreditCard, LayoutDashboard, Globe, Users, TrendingUp,
  User, Image as ImageIcon, Camera, Music, Lightbulb, CircleAlert,
  type LucideIcon,
} from 'lucide-react'

/**
 * El set de íconos de la app. Es el mismo paquete (lucide) que usa
 * manso.club: línea fina, sin color propio, hereda el `currentColor` de
 * quien lo contenga. Reemplaza a los emojis, que traían su propia paleta
 * —y su propio tono— a una interfaz que no los había pedido.
 *
 * Las claves son en castellano a propósito: se guardan en la base
 * (`venue_config.cowork_landing`) y las lee gente, no solo el código.
 */
export const ICONOS = {
  silla: Armchair,
  wifi: Wifi,
  cafe: Coffee,
  silencio: VolumeX,
  enchufe: Plug,
  planta: Leaf,
  impresora: Printer,
  laptop: Laptop,
  comida: UtensilsCrossed,
  auriculares: Headphones,
  calendario: CalendarDays,
  entrada: Ticket,
  cine: Clapperboard,
  barra: Beer,
  celular: Smartphone,
  efectivo: Banknote,
  tarjeta: CreditCard,
  panel: LayoutDashboard,
  publico: Globe,
  comunidad: Users,
  stats: TrendingUp,
  persona: User,
  imagen: ImageIcon,
  camara: Camera,
  musica: Music,
  idea: Lightbulb,
  alerta: CircleAlert,
} satisfies Record<string, LucideIcon>

export type IconoNombre = keyof typeof ICONOS

/**
 * Las tarjetas del Cowork guardadas antes de este cambio tienen el emoji
 * escrito en el campo `icono`. En vez de migrar la base, las traducimos al
 * vuelo: lo viejo sigue mostrándose bien y lo nuevo ya guarda el nombre.
 */
const DESDE_EMOJI: Record<string, IconoNombre> = {
  '🪑': 'silla',
  '📶': 'wifi',
  '☕': 'cafe',
  '🤫': 'silencio',
  '🔌': 'enchufe',
  '🌿': 'planta',
  '🖨': 'impresora',
  '🧑‍💻': 'laptop',
  '💻': 'laptop',
  '🍽': 'comida',
  '🎧': 'auriculares',
  '🗓': 'calendario',
  '🎟': 'entrada',
  '🎫': 'entrada',
  '🎬': 'cine',
  '🍺': 'barra',
  '🍻': 'barra',
  '📲': 'celular',
  '📱': 'celular',
  '💵': 'efectivo',
  '💳': 'tarjeta',
  '📊': 'panel',
  '🌐': 'publico',
  '👥': 'comunidad',
  '📈': 'stats',
  '👤': 'persona',
  '🖼': 'imagen',
  '📷': 'camara',
  '🎵': 'musica',
  '🎶': 'musica',
  '💡': 'idea',
}

/** Resuelve un valor guardado (nombre nuevo o emoji viejo) a un ícono. */
export function resolverIcono(valor: string | null | undefined): LucideIcon | null {
  if (!valor) return null
  const limpio = valor.trim().replace(/️/g, '')
  if (limpio in ICONOS) return ICONOS[limpio as IconoNombre]
  return DESDE_EMOJI[limpio] ? ICONOS[DESDE_EMOJI[limpio]] : null
}
