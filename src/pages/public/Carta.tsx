import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

type Product = {
  id: string
  name: string
  price: number
  category: 'bebida' | 'comida' | 'otro'
}

const CATEGORY_LABELS: Record<string, string> = {
  bebida: 'Bebidas',
  comida: 'Comidas',
  otro: 'Otros',
}

const CATEGORY_ORDER = ['bebida', 'comida', 'otro']

function formatPrice(n: number): string {
  return `$${n.toLocaleString('es-AR')}`
}

export default function Carta() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, price, category')
      .order('name')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('No pudimos cargar la carta. Verificá tu conexión e intentá de nuevo.')
        } else if (data) {
          setProducts(data as Product[])
        }
        setLoading(false)
      })
  }, [])

  const grouped = CATEGORY_ORDER.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = products.filter(p => p.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

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
        </div>

        <p className="text-center text-gray-300 text-sm font-semibold uppercase tracking-[0.25em] mb-8">
          Carta digital
        </p>

        <div className="px-8 space-y-10 max-w-md mx-auto w-full">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/10" />
                <h2 className="text-white/60 text-xs uppercase tracking-[0.2em] font-bold">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-3">
                {items.map(product => (
                  <div
                    key={product.id}
                    className="border border-white/10 rounded-2xl px-6 py-5 bg-neutral-900"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-base">{product.name}</p>
                      <p className="text-emerald-400 text-xl font-bold">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 text-sm">No hay productos disponibles</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
