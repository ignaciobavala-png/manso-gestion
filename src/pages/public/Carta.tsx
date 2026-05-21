import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

type Product = {
  id: string
  name: string
  price: number
  category: 'bebida' | 'comida' | 'otro'
  subcategory: string | null
  sort_order: number
}

interface Group {
  key: string
  label: string
  items: Product[]
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString('es-AR')}`
}

function buildGroups(products: Product[]): Group[] {
  const groups: Group[] = []

  const add = (key: string, label: string, items: Product[]) => {
    if (items.length > 0) groups.push({ key, label, items })
  }

  const bebidas = products.filter(p => p.category === 'bebida')
  add('trago',       'Tragos',      bebidas.filter(p => p.subcategory === 'trago'))
  add('vino',        'Vinos',       bebidas.filter(p => !p.subcategory))
  add('cerveza',     'Cervezas',    bebidas.filter(p => p.subcategory === 'cerveza'))
  add('sin_alcohol', 'Sin alcohol', bebidas.filter(p => p.subcategory === 'sin_alcohol'))

  add('comida', 'Comidas', products.filter(p => p.category === 'comida'))
  add('otro',   'Otros',   products.filter(p => p.category === 'otro'))

  return groups
}

function AccordionGroup({ group }: { group: Group }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`relative rounded-2xl ${!open ? 'p-[1.5px] overflow-hidden' : 'border border-white/10'}`}>
      {!open && (
        <div
          className="absolute animate-spin pointer-events-none"
          style={{
            inset: '-50%',
            background: 'conic-gradient(from 0deg, transparent 0%, transparent 88%, rgba(16,185,129,0.5) 94%, rgba(110,231,183,0.7) 97%, transparent 100%)',
            animationDuration: '4s',
            animationTimingFunction: 'linear',
          }}
        />
      )}
      <div className="relative bg-neutral-900 rounded-2xl overflow-hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          <span className="text-white font-semibold text-sm tracking-wide">{group.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</span>
            <span className={`text-gray-400 text-sm transition-transform duration-200 inline-block ${open ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </div>
        </button>

        {open && (
          <div className="divide-y divide-white/5">
            {group.items.map(product => (
              <div key={product.id} className="flex items-center justify-between px-5 py-4">
                <p className="text-white text-sm font-medium">{product.name}</p>
                <p className="text-emerald-400 text-base font-bold ml-4 flex-shrink-0">{formatPrice(product.price)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Carta() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aliasCopied, setAliasCopied] = useState(false)

  const copyAlias = () => {
    navigator.clipboard.writeText('MANSO.CLUB')
    setAliasCopied(true)
    setTimeout(() => setAliasCopied(false), 2000)
  }

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, price, category, subcategory, sort_order')
      .order('sort_order')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('No pudimos cargar la carta. Verificá tu conexión e intentá de nuevo.')
        } else if (data) {
          setProducts(data as Product[])
        }
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  if (error) {
    return (
      <PublicLayout>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 -mt-12">
          <p className="text-4xl">😕</p>
          <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
          <p className="text-gray-300 text-sm max-w-xs">{error}</p>
          <button
            onClick={() => navigate(0)}
            className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors"
          >
            Intentar de nuevo →
          </button>
        </div>
      </PublicLayout>
    )
  }

  const groups = buildGroups(products)

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col pb-12 items-center">
        <div className="w-full max-w-md px-8">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg mb-6"
          >
            ←
          </button>
          <h1 className="text-white font-bold text-2xl text-center -mt-10 mb-6">Carta</h1>
        </div>

        <div className="mb-8 px-6 w-full max-w-md mx-auto">
          <button
            onClick={copyAlias}
            className="w-full bg-white/5 border border-white/10 hover:border-emerald-500/50 rounded-2xl px-4 py-4 text-center transition-all active:scale-95"
          >
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Alias de pago</p>
            <p className="text-white font-mono text-xl font-bold">
              {aliasCopied ? '✓ Copiado' : 'MANSO.CLUB'}
            </p>
            {!aliasCopied && <p className="text-white/30 text-xs mt-1">Tocá para copiar</p>}
          </button>
        </div>

        <div className="px-4 max-w-md mx-auto w-full">
          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-600 text-sm">No hay productos disponibles</p>
              </div>
            ) : (
              groups.map(group => <AccordionGroup key={group.key} group={group} />)
            )}
          </div>

          <div className="flex justify-center items-center gap-4 mt-3 mb-4">
            {/* Gin: imagen vertical, ocupa bien su espacio */}
            <img
              src="/marcas/gin.png"
              alt="Heredero"
              style={{ width: '40vw', maxWidth: 160, height: 'auto' }}
            />
            {/* Warsteiner: imagen cuadrada con mucho padding — recortamos con overflow hidden */}
            <div style={{ width: '40vw', maxWidth: 160, overflow: 'hidden' }}>
              <img
                src="/marcas/warsteiner_transparent.png"
                alt="Warsteiner"
                style={{ width: '100%', transform: 'scale(2)', transformOrigin: 'center center', filter: 'invert(1)', display: 'block' }}
              />
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
